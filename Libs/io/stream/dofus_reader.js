const { custom_reader } = require('../custom_stream/index');

const MASK_10000000 = 0x80;
const MASK_01111111 = 0x7F;

class dofus_reader extends custom_reader {
    constructor(buffer) {
        super(buffer);
    }

    readVar() {
        let has_next = false;
        let offset = 0;
        // First ensure that data is 0, then write over it with
        // logical OR.
        let data = 0;

        do {
            let byte = this.readByte();
            has_next = (byte & MASK_10000000) > 0;

            data = data | (byte & MASK_01111111) << offset;

            offset = offset + 7;
        } while (has_next);
        return data;
    }

    readVarShort() {
        return this.readVar();
    }

    readVarInt() {
        return this.readVar();
    }

    readVarLong() {
        let ans = 0n;
        for (let i = 0n; i < 64n; i = i + 7n) {
            const b = BigInt(this.readByte());
            ans += (b & 127n) << i;
            if ((b & 128n) === 0n) {
                return parseInt(ans);
            }
        }
        throw 'Too much data';
    }
}

module.exports = dofus_reader;