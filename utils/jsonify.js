const { Transform } = require('stream');


class Jsonify extends Transform {
  constructor(options){
    super(options)
    this._fileName = options.fileName;
    this._messageType = options._messageType;
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