const { custom_writer } = require('../custom_stream/index');

const MASK_10000000 = 0x80;
const MASK_01111111 = 0x7F;

class dofus_writer extends custom_writer {
    constructor(buffer) {
        super(buffer);
    }

    writeVar(value) {
        let has_next = false;

        do {
            let byte = value & MASK_01111111;
            value = value >>> 7;
            has_next = value > 0;

            if (has_next) {
                byte = byte | MASK_10000000;
            }
            this.writeByte(byte);
        } while (has_next);
    }

    writeVarInt(value) {
        this.writeVar(value);
    }

    writeVarShort(value) {
        this.writeVar(value);
    }

    writeVarLong(value) {
        let has_next = false;

        value = BigInt(value);

        do {
            let byte = value & BigInt(MASK_01111111);
            value = value >> 7n;
            has_next = value > 0;

            if (has_next) {
                byte = byte | BigInt(MASK_10000000);
            }
            this.writeByte(parseInt(byte));
        } while (has_next);
    }
}

module.exports = dofus_writer;