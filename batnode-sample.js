const BatNode = require('./batnode').BatNode;
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;

// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests

// When sending image data as part of JSON object, two JSON objects are sent, each sending an incomplete JSON object
// with only part of the image data
const node1ConnectionCallback = (serverConnection) => {
  serverConnection.on('data', (receivedData, error) => {
   // console.log("received data: ", receivedData)
    receivedData = JSON.parse(receivedData)

    //console.log(receivedData, "FROM SERVER")

    if (receivedData.messageType === "RETRIEVE_FILE") {
      node1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
       content = {
         data
       }
       serverConnection.write(content) // sends as two chunks because JSON object too large; so sends an incomplete JSON object in buffer form. Replace "content" w/ "data" for single chunk
      })
    } else if (receivedData.messageType === "STORE_FILE"){
      let content = new Buffer(receivedData.fileContent, 'base64')
      node1.writeFile(`./stored/${receivedData.fileName}-1`, content)
    }
  })
}




const node1 = new BatNode()
node1.createServer(1237, '127.0.0.1', node1ConnectionCallback, null)


// -------------------------------------
// Example of a second node retrieving a file from a node hosting the data



const node2 = new BatNode()
node2.retrieveFile('image.png', 1237, '127.0.0.1', (data, fileName) => {
  console.log(JSON.stringify(data), "What client received from server")
  data = data.toString('base64')
  data = new Buffer(data, 'base64')
  node2.writeFile(`./hosted/1-${fileName}`, data)
})



// ---------------------------------------
// Example of a node sending a file to the server

/*
const node2 = new BatNode()
node2.sendFile(1237, '127.0.0.1', './hosted/image.png', 'image.png')
*/

// ---------------------------------------
// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
