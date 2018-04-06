const { Transform } = require('stream');


class Jsonify extends Transform {
  constructor(options){
    options.objectMode = true;
    super(options)
    this._fileName = options.fileName;
    this._messageType = options.messageType;
    this.writab
  }

  _transform(chunk, encoding, callback){
    this.push(JSON.stringify({
      fileName: this._fileName,
      messageType: this._messageType,
      fileContent: chunk
    }))

    callback()
  }

}

exports.Jsonify = Jsonify