const custom_stream = require('./custom_stream');

class custom_writer extends custom_stream{
    constructor(buffer){
        super(buffer);
    }

    writeByte(byte){
        const buffer = Buffer.alloc(1);
        buffer.writeUInt8(byte);
        // add byte
        this.add(buffer);
        // increment current position
        this.skip(1);
    }

    writeSignedByte(byte){
        const buffer = Buffer.alloc(1);
        buffer.writeInt8(byte);
        // add byte
        this.add(buffer);
        // increment current position
        this.skip(1);
    }

    writeBytes(byteArray){
        byteArray.forEach(byte => this.writeByte(byte));
    }

    writeShort(value){
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(value);
        this.writeBytes([...buf]);
    }

    writeUnsignedShort(value){
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(value);
        this.writeBytes([...buf]);
    }

    writeInt(value){        
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(value);
        this.writeBytes([...buf]);
    }

    writeUnsignedInt(value){        
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(value);
        this.writeBytes([...buf]);
    }

    writeLong(value){        
        const buf = Buffer.alloc(8);
        buf.writeBigInt64BE(BigInt(value));
        this.writeBytes([...buf]);
    }

    writeUnsignedLong(value){        
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64BE(BigInt(value));
        this.writeBytes([...buf]);
    }

    writeBoolean(value){
        if(value) this.writeByte(1);
        else this.writeByte(0);
    }

    writeDouble(value){   
        const buf = Buffer.alloc(8);
        buf.writeDoubleBE(value);
        this.writeBytes([...buf]);
    }

    writeFloat(value){
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(value);
        this.writeBytes([...buf]);
    }

    writeUTF(value){
        const bytes = new TextEncoder('utf-8').encode(value);
        this.writeUnsignedShort(bytes.length);
        this.writeBytes(bytes);
    }
}

module.exports = custom_writer;