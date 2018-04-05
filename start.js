const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('./batnode.js').BatNode;
const kad_bat = require('./kadence_plugin').kad_bat;
const stellar_account = require('./kadence_plugin').stellar_account;
const seed = require('./constants').SEED_NODE;
const cliServer = require('./constants').CLI_SERVER;
const batNodePort = require('./constants').BATNODE_SERVER_PORT
const kadNodePort = require('./constants').KADNODE_PORT
const publicIp = require('public-ip');
const fs = require('fs');
const fileUtils = require('./utils/file').fileSystem;
const JSONStream = require('JSONStream');
const backoff = require('backoff');


publicIp.v4().then(ip => {
 const kademliaNode = new kad.KademliaNode({
    transport: new kad.HTTPTransport(),
    storage: levelup(encoding(leveldown('./dbbb'))),
    contact: {hostname: ip, port: kadNodePort}
  })

  kademliaNode.plugin(kad_bat)
  kademliaNode.plugin(stellar_account)
  kademliaNode.listen(kadNodePort)
  const batNode = new BatNode(kademliaNode)
  kademliaNode.batNode = batNode

  const nodeConnectionCallback = (serverConnection) => {
    serverConnection.on('end', () => {
      console.log('end')
    })

    const stream = JSONStream.parse();
    serverConnection.pipe(stream);

    stream.on('data', (receivedData, error) => {
      if (error) { throw error; }
     console.log("received data: ", receivedData)

      if (receivedData.messageType === "RETRIEVE_FILE") {
        batNode.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
         serverConnection.write(data)
        })
      } else if (receivedData.messageType === "STORE_FILE"){
        let fileName = receivedData.fileName
        batNode.kadenceNode.iterativeStore(fileName, [batNode.kadenceNode.identity.toString(), batNode.kadenceNode.contact], (err, stored) => {
          console.log('nodes who stored this value: ', stored)
          let fileContent = new Buffer(receivedData.fileContent)
          batNode.writeFile(`./hosted/${fileName}`, fileContent, (writeErr) => {
            if (writeErr) {
              throw writeErr;
            }
            serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
          })
        })
      } else if (receivedData.messageType === "AUDIT_FILE") {
        fs.exists(`./hosted/${receivedData.fileName}`, (doesExist) => {
          if (doesExist) {
            fs.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
              const shardSha1 = fileUtils.sha1HashData(data);
              serverConnection.write(shardSha1);
            });
          } else {
            serverConnection.write("Shard not found")
          }
        })
      }
    })
  }

  const nodeCLIConnectionCallback = (serverConnection) => {

    const sendAuditDataWhenFinished = (exponentialBackoff) => {
      exponentialBackoff.failAfter(10);
      exponentialBackoff.on('backoff', function(number, delay) {
        console.log(number + ' ' + delay + 'ms');
      });
      exponentialBackoff.on('ready', function() {
        if (!batNode.audit.ready) {
          exponentialBackoff.backoff();
        } else {
          serverConnection.write(JSON.stringify(batNode.audit));
          return;
        }
      });
      exponentialBackoff.on('fail', function() {
        console.log('Timeout: failed to complete audit');
      });
      exponentialBackoff.backoff();
    }

    serverConnection.on('data', (data) => {
      let receivedData = JSON.parse(data);

      if (receivedData.messageType === "CLI_UPLOAD_FILE") {
        let filePath = receivedData.filePath;

        batNode.uploadFile(filePath)
      } else if (receivedData.messageType === "CLI_DOWNLOAD_FILE") {
        let filePath = receivedData.filePath;

        batNode.retrieveFile(filePath);
      } else if (receivedData.messageType === "CLI_AUDIT_FILE") {
        let filePath = receivedData.filePath;
        let exponentialBackoff = backoff.exponential({
            randomisationFactor: 0,
            initialDelay: 20,
            maxDelay: 10000
        });

        batNode.auditFile(filePath);
        // post audit cleanup
        serverConnection.on('close', () => {
          batNode.audit.ready = false;
          batNode.audit.data = null;
          batNode.audit.passed = false;
          batNode.audit.failed = [];
        });

        // Exponential backoff until file audit finishes
        sendAuditDataWhenFinished(exponentialBackoff);

      } else if (receivedData.messageType === "CLI_PATCH_FILE") {
        const { manifestPath, siblingShardId, failedShaId, copiesToRemoveFromManifest } = receivedData;
          batNode.patchFile(manifestPath, failedShaId, siblingShardId, copiesToRemoveFromManifest)
      }
    })
  }

  batNode.createCLIServer(cliServer.port, cliServer.host, nodeCLIConnectionCallback);
  batNode.createServer(batNodePort, ip, nodeConnectionCallback)


  kademliaNode.join(seed, () => {
    console.log('you have joined the network! Ready to accept commands from the CLI!')
  })


})
