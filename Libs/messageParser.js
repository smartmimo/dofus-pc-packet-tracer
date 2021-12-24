const message_decoder = require('./buffer/message_decoder');
const buffer_writer = require('./buffer/buffer_writer');
const { dofus_writer } = require('./io');

module.exports = async(server, socket, data, from_client) => {
    const receiver = from_client ? socket : socket.remote;
    // console.log(receiver, from_client)
    const result = receiver.buffer_reader.parse_data(data);
    const instance_id_writer = new dofus_writer([]);

    for (let i = 0; i < result.length; i++) {
        result[i].message_data_decoded = message_decoder(server.dofus_protocol, result[i].message_data_buffer, result[i].message_id);

        if (!result[i].message_data_decoded.error) {
            if (from_client) {
                socket.LAST_INSTANCE_ID = result[i].instance_id;
                socket.DIFF_INSTANCE_ID = 0;

                const message_data = new buffer_writer(from_client).parse_message({
                    message_id: result[i].message_id,
                    instance_id: socket.current_instance_id(),
                    data: result[i].message_data_buffer
                });

                instance_id_writer.writeBytes(message_data);
            } else {
                socket.DIFF_INSTANCE_ID++;
            }

            // await handle_message(server, socket, result[i]);
        }
    }

    // console.log(result.message_data_decoded)
    if (from_client) {
        return {
            messages: result.map(e => e.message_data_decoded),
            buffer: instance_id_writer.data()
        };
    }

    // return data;
    return {
        messages: result.map(e => e.message_data_decoded),
        buffer: data
    };
};