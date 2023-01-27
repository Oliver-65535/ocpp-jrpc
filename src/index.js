const http = require("http");
const { RPCServer } = require("ocpp-rpc");

const httpServer = http.createServer();
const rpcServer = new RPCServer({
  protocols: ["ocpp1.6"], // server accepts ocpp1.6 subprotocol
  strictMode: false, // enable strict validation of requests & responses
});

httpServer.on("upgrade", rpcServer.handleUpgrade);

rpcServer.on("client", async (client) => {
  client.handle("BootNotification", ({ params }) => {
    console.log(`Server got BootNotification from ${client.identity}:`, params);

    // respond to accept the client
    return {
      status: "Accepted",
      interval: 1,
      currentTime: new Date().toISOString(),
    };
  });

  // create a specific handler for handling Heartbeat requests
  client.handle("Heartbeat", ({ params }) => {
    console.log(`Server got Heartbeat from ${client.identity}:`, params);

    // respond with the server's current time.
    return {
      currentTime: new Date().toISOString(),
    };
  });
});

httpServer.listen(9000, () => {
  console.log("Server listening on port 9000");
});
