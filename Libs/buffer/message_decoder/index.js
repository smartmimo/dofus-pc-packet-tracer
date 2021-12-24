const { dofus_reader, wrapper_get_flag } = require('../../io');

const message_decoder = (protocol, buffer, protocol_id) => {
    if(!protocol){
        return {
            error: 'no protocol found'
        }
    }

    const messages = protocol.getData('/messages');
    const types = protocol.getData('/types');

    // console.log(messages)
    const get_message_func = filter => messages.find(filter);
    const get_type_func = filter => types.find(filter);

    const get_message_and_type_func = filter => [get_message_func(filter), get_type_func(filter)].filter(x => x).shift();
    const message_metadata = get_message_func(m => m.protocolID === protocol_id);

    try{
        const reader = new dofus_reader(buffer);
        return element_decoder(get_message_func, get_type_func, get_message_and_type_func, reader, message_metadata);
    }catch(error){
        return {
            error: error.message
        }
    }
}

const element_decoder = (get_message_func, get_type_func, get_message_and_type_func, data_reader, metadata) => {
    let result = {
        __name: undefined,
        __protocol_id: undefined
    };

    if(metadata.super_serialize){
        const super_metadata = get_message_and_type_func(mt => mt.name === metadata.super);

        result = {
            ...element_decoder(get_message_func, get_type_func, get_message_and_type_func, data_reader, super_metadata)
        };
    }

    // parse boolean 
    const bools = metadata.fields.filter(v => v.use_boolean_byte_wrapper).sort((a, b) => a.boolean_byte_wrapper_position - b.boolean_byte_wrapper_position);
    let flag = 0;
    for (let bit = 0; bit < bools.length; bit++) {
        const b = bools[bit];
        const w_pos = b.boolean_byte_wrapper_position - 1;
        if (w_pos % 8 === 0) {
            flag = data_reader.readByte();
        }

        result[b.name] = wrapper_get_flag(flag, w_pos % 8);
    }

    // parse properties
    const properties = metadata.fields.filter(v => !v.use_boolean_byte_wrapper).sort((a, b) => a.position - b.position);
    for(let pit = 0;pit < properties.length; pit++){
        const p = properties[pit];
        const prop_metadata = get_message_and_type_func(mt => mt.name === p.type);

        function read_var() {
            if(!prop_metadata){ // primitive case
                return data_reader[p.write_method.replace('write', 'read')]();
            }

            if (p.write_false_if_null_method) {
                if (data_reader[p.write_false_if_null_method.replace('write', 'read')]() === 0) return null;
            }

            if (p.prefixed_by_type_id) { // object case
                const protocol_id = data_reader[p.write_type_id_method.replace('write', 'read')]();
                return element_decoder(get_message_func, get_type_func, get_message_and_type_func, data_reader, get_type_func(t => t.protocolID === protocol_id));
            }
            
            return element_decoder(get_message_func, get_type_func, get_message_and_type_func, data_reader, prop_metadata);
        }

        if(p.is_vector || p.type === 'ByteArray') {// array case
            const l = p.constant_length ? p.constant_length : data_reader[p.write_length_method.replace('write', 'read')]();
            if (p.type === 'ByteArray') {
                result[p.name] = data_reader.readBytes(l);
            } else {
                result[p.name] = [];
                for (let it = 0; it < l; it++) {
                    result[p.name][it] = read_var();
                }
            }
        }else{
            result[p.name] = read_var();
        }
    }

    return {
        ...result,
        __name: metadata.name,
        __protocol_id: metadata.protocolID
    };
}

module.exports = message_decoder;