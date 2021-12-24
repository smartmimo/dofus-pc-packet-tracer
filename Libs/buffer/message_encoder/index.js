const { dofus_writer, wrapper_set_flag } = require('../../io');

const message_encoder = (protocol, message) => {
    if(!protocol){
        return {
            error: 'no protocol found'
        }
    }

    const messages = protocol.getData('/messages');
    const types = protocol.getData('/types');

    const get_message_func = filter => messages.find(filter);
    const get_type_func = filter => types.find(filter);

    const get_message_and_type_func = filter => [get_message_func(filter), get_type_func(filter)].filter(x => x).shift();
    const message_metadata = get_message_func(m => m.name === message.__name);

    try{
        return {
            protocol_id: message_metadata.protocolID,
            buffer: element_encoder(get_message_func, get_type_func, get_message_and_type_func, new dofus_writer([]), message_metadata, message)
        }
    }catch(error){
        return {
            error: error.message,
            data: message
        }
    }
}

const element_encoder = (get_message_func, get_type_func, get_message_and_type_func, data_writer, metadata, message) => {
    if(metadata.super_serialize){
        const super_metadata = get_message_and_type_func(mt => mt.name === metadata.super);
        data_writer = new dofus_writer(element_encoder(get_message_func, get_type_func, get_message_and_type_func, data_writer, super_metadata, message));
    }

    // parse bool
    const bools = metadata.fields.filter(v => v.use_boolean_byte_wrapper).sort((a, b) => a.boolean_byte_wrapper_position - b.boolean_byte_wrapper_position);
    const flags = [];
    for (let bit = 0; bit < bools.length; bit++) {
        const b = bools[bit];
        const w_pos = b.boolean_byte_wrapper_position - 1;
        flags[b.position] = wrapper_set_flag(flags[b.position], w_pos % 8, message[b.name]);
    };
    data_writer.writeBytes(flags);

    // parse properties
    const properties = metadata.fields.filter(v => !v.use_boolean_byte_wrapper).sort((a, b) => a.position - b.position);
    for (let pit = 0; pit < properties.length; pit++) {
        const p = properties[pit];
        const prop_metadata = get_message_and_type_func(mt => mt.name === p.type); 
        function write_var(value){
            if(!prop_metadata){ // primitiv case
                data_writer[p.write_method](value);
                return;
            }

            if(p.write_false_if_null_method){
                if(value === null || value === undefined){
                    data_writer[p.write_false_if_null_method](0);
                    return;
                }
            }

            if(p.prefixed_by_type_id){ // object case
                const type_metadata = get_type_func(t => t.name === value.__name);
                data_writer[p.write_type_id_method](type_metadata.protocolID);
                data_writer.writeBytes(element_encoder(get_message_func, get_type_func, get_message_and_type_func, data_writer, type_metadata, value));
                return;
            }
            data_writer.writeBytes(element_encoder(get_message_func, get_type_func, get_message_and_type_func, data_writer, prop_metadata, value));
        }

        // if array
        if(p.is_vector || p.type === 'ByteArray'){
            const l = p.constant_length ? p.constant_length : message[p.name].length;
            if(!p.constant_length){
                data_writer[p.write_length_method](l);
            }
            if(p.type === 'ByteArray') data_writer.writeBytes(message[p.name]);
            else message[p.name].forEach(el => write_var(el));
        }else{
            write_var(message[p.name]);
        }
    };

    return data_writer.data();
}

module.exports = message_encoder;