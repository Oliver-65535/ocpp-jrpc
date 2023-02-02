import http from "http";
import { RPCServer } from "ocpp-rpc";
import { nanoid } from "nanoid";

import ChargePoint from "./charge-point";

const httpServer = http.createServer();
const rpcServer = new RPCServer({
  protocols: ["ocpp1.6"], // server accepts ocpp1.6 subprotocol
  strictMode: false, // enable strict validation of requests & responses
});

httpServer.on("upgrade", rpcServer.handleUpgrade);

const chargePoints: { [key: string]: ChargePoint } = {};
const idTags: string[] = [];
const transactions = {};

httpServer.on("request", async (req, res) => {
  // GET /charge-points
  if (req.url === "/charge-points") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify(Object.keys(chargePoints)));
    res.end();
    return;
  }

  // GET /charge-points/:chargePointId/number-of-connectors
  if (req.url?.startsWith("/charge-points/") && req.url.endsWith("/number-of-connectors")) {
    const chargePointId = req.url.split("/")[2];
    if (chargePointId in chargePoints) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write(
        JSON.stringify({
          numberOfConnectors: parseInt(await chargePoints[chargePointId].getNumConnectors(), 10),
        })
      );
      res.end();
      return;
    } else {
      res.writeHead(404);
      res.write("Charge point not found");
      res.end();
      return;
    }
  }

  // GET /id-tags
  if (req.url === "/id-tags" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify(idTags));
    res.end();
    return;
  }

  // POST /id-tags
  if (req.url === "/id-tags" && req.method === "POST") {
    const idTag = nanoid(20);
    idTags.push(idTag);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.write(JSON.stringify({ idTag }));
    res.end();
    return;
  }

  // POST /transactions
  if (req.url === "/transactions" && req.method === "POST") {
    const body = await new Promise((resolve) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        resolve(body);
      });
    });

    const { chargePointId, connectorId, idTag } = JSON.parse(body as any);

    if (chargePoints[chargePointId]) {
      const response = await chargePoints[chargePointId].startTransaction({
        connectorId,
        idTag,
      });
      console.log("response", response);
      const transactionId = nanoid();
      transactions[transactionId] = {
        chargePointId,
        connectorId,
        idTag,
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write(JSON.stringify({ transactionId }));
      res.end();
      return;
    } else {
      res.writeHead(404);
      res.write("Charge point not found");
      res.end();
      return;
    }
  }

  // GET /local-list/:chargePointId/version
  if (req.url.startsWith("/local-list/") && req.url.endsWith("/version") && req.method === "GET") {
    const chargePointId = req.url.split("/")[2];
    if (chargePoints[chargePointId]) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.write(
        JSON.stringify({
          localListVersion: await chargePoints[chargePointId].getLocalListVersion(),
        })
      );
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
  client.handle('BootNotification', ({ params }) => {
    console.log(`Server got BootNotification from ${client.identity}:`, params);

    // save the client in the database
    chargePoints[client.identity] = new ChargePoint(client.identity, client)

    // respond to accept the client
    return {
      status: "Accepted",
      interval: 300,
      currentTime: new Date().toISOString()
    };
  });

  // create a specific handler for handling Heartbeat requests
  client.handle('Heartbeat', ({ params }) => {
    console.log(`Server got Heartbeat at ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} from ${client.identity}:`, params);

    // respond with the server's current time.
    return {
      currentTime: new Date().toISOString()
    };
  });

  // create a specific handler for handling StatusNotification requests
  client.handle('StatusNotification', ({ params }) => {
    console.log(`Server got StatusNotification from ${client.identity}:`, params);
    return {};
  });

  // create a wildcard handler to handle any RPC method
  client.handle(({ method, params }) => {
    // This handler will be called if the incoming method cannot be handled elsewhere.
    console.log(`Server got ${method} from ${client.identity}:`, params);

    // throw an RPC error to inform the server that we don't understand the request.
    throw createRPCError("NotImplemented");
  });
})

httpServer.listen(9000, () => {
  console.log("Server listening on port 9000");
});
