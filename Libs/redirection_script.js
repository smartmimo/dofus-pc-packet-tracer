/**
 * THIS SCRIPT WAS COPIED FROM FRITM 
 * FRITM : https://github.com/louisabraham/fritm
 * SCRIPT : https://github.com/louisabraham/fritm/blob/master/fritm/script.js
 *
 */
var connect_p = Module.getExportByName(null, 'connect');
var send_p = Module.getExportByName(null, 'send');
// ssize_t send(int sockfd, const void * buf, size_t len, int flags);
var socket_send = new NativeFunction(send_p, 'int', ['int', 'pointer', 'int', 'int']);
var recv_p = Module.getExportByName(null, 'recv');
// ssize_t recv(int sockfd, void *buf, size_t len, int flags);
var socket_recv = new NativeFunction(recv_p, 'int', ['int', 'pointer', 'int', 'int']);

Interceptor.attach(connect_p, {
    onEnter: function(args) {
        this.sockfd = args[0];
        var sockaddr_p = args[1];
        this.sa_family = sockaddr_p.add(1).readU8();
        this.port = 256 * sockaddr_p.add(2).readU8() + sockaddr_p.add(3).readU8();
        this.addr = '';
        for (var i = 0; i < 4; i++) {
            this.addr += sockaddr_p.add(4 + i).readU8(4);
            if (i < 3) this.addr += '.';
        }

        var newport = PORT;
        sockaddr_p.add(2).writeByteArray([Math.floor(newport / 256), newport % 256]);
        sockaddr_p.add(4).writeByteArray([127, 0, 0, 1]);

        console.log(`Connection to: ${this.addr}:${this.port}`);
    },
    onLeave: function(retval) {
        var connect_request = `ORIGINAL ${this.addr}:${this.port} #_PROCESS_ID_#\r\n`;
        var buf_send = Memory.allocUtf8String(connect_request);
        socket_send(this.sockfd.toInt32(), buf_send, connect_request.length, 0);

        // idk why 'louisabraham' put this here but it this loops is not needed anymore

        // This loops is needed on Windows
        // for unknown reasons
        /*while (recv_return == -1) {
            Thread.sleep(0.05);
            recv_return = socket_recv(this.sockfd.toInt32(), buf_recv, 512, 0);
        }
        console.log('buf_rcv:', buf_recv.readCString());*/
    }
})