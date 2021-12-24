const frida = require("frida");
const fs = require("fs");
const net = require('net');
const path = require('path');
const express = require('express')
const WebSocket = require('ws');

const buffer_reader = require('./Libs/buffer/buffer_reader');
const buffer_writer = require('./Libs/buffer/buffer_writer');
const message_encoder = require('./Libs/buffer/message_encoder');

const messageHandler = require("./Libs/messageParser");


const parser = require('./Libs/botofu');
// const parse_d2p = require('../../../dofus/d2p/map_parser');

const dofusPath = "C:/Users/Somi/Desktop/Dofus";

const app = express();
app.use(express.static(path.join(__dirname, "Public/assets")));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname);

var getData;
parser(`${dofusPath}/DofusInvoker.swf`, __dirname, "dummy", () => {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "dummy"), "utf8"))
    getData = (path) => data[path.replace("/", "")]
    console.log(`Protocol ${['server_dofus_invoker']} parsed`);
});

var logs = [];
const sendToBrowser = (message, data = null, type) => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                message,
                data,
                type
            }));
        }
    })
    logs.push({ message, data, type })
}

async function start() {
    const randomPort = getRandomInt(1, 65534)
    var redirection_script = fs.readFileSync("./Libs/redirection_script.js", "utf8").replace('PORT', randomPort);

    console.log("Spawning process from", `${dofusPath}/Dofus.exe`)
    const pid = parseInt(process.argv[2]) || await frida.spawn(`${dofusPath}/Dofus.exe`); //spawning process
    console.log("Attaching frida:", pid)
    const session = await frida.attach(pid); //attaching frida to process

    redirection_script = redirection_script.replace('#_PROCESS_ID_#', `${pid}`); //prepping script

    console.log("Injecting script..")
    const script = await session.createScript(redirection_script); //creating script on frida session
    script.message.connect((message, data) => console.log(message, data)); //creating output
    console.log("Loading script..")
    await script.load(); //loading script

    frida.resume(pid); //carrying on


    /*MITM*/
    const server = new net.Server();
    server.clients = new Set();

    server.on('listening', () => {
        console.log("MITM Server is listening..")

        server.dofus_protocol = {
            getData
        }


        /*parse_d2p(`${dofusPath}/Dofus.exe`, map_folder_path).then(_ => {
            server.dofus_map = map_folder_path;
            console.log(`Map ${server['server_dofus_map']} parsed`);
        });*/

    });
    server.on('close', () => console.log("MITM Server is closed."));
    server.on('error', e => console.log("MITM Server error: ", e));

    server.on('connection', socket => {
        // remove client from server function
        const mitm_client_remove = _ => {
                // if not closing
                if (!socket.is_closing) {
                    socket.is_closing = true;
                    socket.destroy();
                    socket.remote.destroy();
                    socket.remote.is_connected = false;
                    server.clients.delete(socket);
                    // call close event
                    console.log("Client closed.")
                }
            }
            // write error function
        const mitm_client_error = error => {
            console.log("MITM Server error:", error)
            mitm_client_remove();
        }

        // create new remote client
        socket.remote = new net.Socket();

        // set client close event
        socket.on('close', mitm_client_remove);
        // set client error event
        socket.on('error', mitm_client_error);
        // set client data event
        socket.on('data', data => {
            const data_string = data.toString();
            // if string is original ip sent from hook script
            if (data_string.startsWith('ORIGINAL')) {
                const request_splitted = data_string.split(' ');
                const ip_port = request_splitted[1];
                const ip_port_splitted = ip_port.split(':');

                socket.remote.on('connect', _ => socket.remote.is_connected = true);
                socket.remote.on('close', mitm_client_remove);
                socket.remote.on('error', mitm_client_error);
                socket.remote.on('data', remote_data => {
                    // handle event and data sent
                    // send data from server to client
                    if (remote_data.length > 0 && !socket.is_closing && socket.remote.is_connected) {
                        messageHandler(server, socket, remote_data, false)
                            .then(payload => {
                                const { messages, buffer } = payload;
                                try {
                                    if (buffer.length > 0) socket.write(buffer);
                                    else socket.destroy();
                                    console.log(messages.map(e => `\x1b[33mRCV\x1b[0m => ${e.__name}`).join("\n"))

                                    for (const payload of messages) {
                                        const message = payload.__name || payload.__protocol_id;
                                        if (!message) continue;
                                        const data = payload
                                        delete data.__name;
                                        delete data.__protocol_id;
                                        sendToBrowser(message, data, "RCV");
                                    }

                                } catch (e) {
                                    console.error(e);
                                }
                            });

                    }
                });
                // connect remote to original server
                socket.remote.connect({
                    host: ip_port_splitted[0],
                    port: parseInt(ip_port_splitted[1])
                });
            } else {
                // handle event and data sent
                // send data from client to server
                if (data.length > 0 && !socket.is_closing && socket && socket.remote.is_connected) {
                    messageHandler(server, socket, data, true)
                        .then(payload => {
                            const { messages, buffer } = payload;
                            try {
                                if (buffer.length > 0) socket.remote.write(buffer);
                                else socket.destroy();
                                console.log(messages.map(e => `\x1b[32mSND\x1b[0m => ${e.__name}`).join("\n"))
                                    // console.log(messages[0]);
                                for (const payload of messages) {
                                    const message = payload.__name || payload.__protocol_id;
                                    if (!message) continue;
                                    const data = payload
                                    delete data.__name;
                                    delete data.__protocol_id;
                                    sendToBrowser(message, data, "SND");
                                }

                            } catch (e) {
                                console.error(e);
                            }
                        });



                }
            }
        });
        // add client to clients list
        server.clients.add(socket);
        // handle client connection event
        console.log("New client connected to MITM Server")
        socket.buffer_reader = new buffer_reader(true);
        socket.remote.buffer_reader = new buffer_reader(false);

        socket.LAST_INSTANCE_ID = 0;
        socket.DIFF_INSTANCE_ID = 0;
        socket.FAKE_MESSAGE_CREATED = 0;

        socket.current_instance_id = () => {
            return socket.LAST_INSTANCE_ID + socket.DIFF_INSTANCE_ID + socket.FAKE_MESSAGE_CREATED;
        }

        socket.send_dofus_message = (dofus_message, from_client, increment_fake_count = true) => {
            const send_socket = from_client ? socket.remote : socket;
            const {
                protocol_id,
                buffer
            } = message_encoder(server.dofus_protocol, dofus_message);

            if (from_client && increment_fake_count) {
                socket.FAKE_MESSAGE_CREATED++;
            }

            const packet_data = new buffer_writer(from_client).parse_message({
                message_id: protocol_id,
                instance_id: socket.current_instance_id(),
                data: buffer
            });

            send_socket.write(packet_data);
        }
    });
    server.listen(randomPort);
}


const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    // runs a callback on message event
    ws.on('message', payload => {
        if (payload == 'start') start()
        else if (payload == 'cache') {
            console.log("opened");
            ws.send(JSON.stringify({
                message: "cache",
                data: logs,
                type: null
            }))
        }
    })
})
const webServer = app.listen(80, () => {
    console.log("Listening on port 80")
})

app.get("/", (req, res) => {
    res.render(path.join(__dirname, 'Public/index.html'));
})

webServer.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, socket => {
        wss.emit('connection', socket, request);
    });
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
}