const http = require("http");
const { RPCServer } = require("ocpp-rpc");

const ChargePoint = require("./charge-point");

const httpServer = http.createServer();
const rpcServer = new RPCServer({
  protocols: ["ocpp1.6"], // server accepts ocpp1.6 subprotocol
  strictMode: false, // enable strict validation of requests & responses
});

httpServer.on("upgrade", rpcServer.handleUpgrade);

const db = {};

httpServer.on("request", async (req, res) => {
  // handle requests to the /clients endpoint
  if (req.url === "/clients") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify(Object.keys(db)));
    res.end();
    return;
  }

  // handle requests to the /clients/:client/connectors endpoint
  if (req.url.startsWith("/clients/") && req.url.endsWith("/connectors")) {
    const client = req.url.split("/")[2];
    if (db[client]) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write(await db[client].getNumConnectors());
      res.end();
      return;
    } else {
      res.writeHead(404);
      res.write("Charge point not found");
      res.end();
      return;
    }
  }
});


rpcServer.on("client", async (client) => {
  // create a specific handler for handling BootNotification requests
  client.handle('BootNotification', ({params}) => {
    console.log(`Server got BootNotification from ${client.identity}:`, params);

    // save the client in the database
    db[client.identity] = new ChargePoint(client.identity, client)

    // respond to accept the client
    return {
      status: "Accepted",
      interval: 300,
      currentTime: new Date().toISOString()
    };
  });
  
  // create a specific handler for handling Heartbeat requests
  client.handle('Heartbeat', ({params}) => {
    console.log(`Server got Heartbeat at ${new Date().toLocaleString("ru-RU", {timeZone: "Europe/Moscow"})} from ${client.identity}:`, params);

    // respond with the server's current time.
    return {
      currentTime: new Date().toISOString()
    };
  });
  
  // create a specific handler for handling StatusNotification requests
  client.handle('StatusNotification', ({params}) => {
    console.log(`Server got StatusNotification from ${client.identity}:`, params);
    return {};
  });

  // create a wildcard handler to handle any RPC method
  client.handle(({method, params}) => {
    // This handler will be called if the incoming method cannot be handled elsewhere.
    console.log(`Server got ${method} from ${client.identity}:`, params);

    // throw an RPC error to inform the server that we don't understand the request.
    throw createRPCError("NotImplemented");
  });
})

httpServer.listen(9000, () => {
  console.log("Server listening on port 9000");
});
