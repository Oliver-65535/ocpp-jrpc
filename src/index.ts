import http from "http";
import express from "express";
import { RPCServer, createRPCError, RPCClient } from "ocpp-rpc";
import { nanoid } from "nanoid";
import formidable from "formidable";

import ChargePoint from "./charge-point";

const app = express();
const server = http.createServer(app);
const rpcServer = new RPCServer({
  protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
  strictMode: false, // enable strict validation of requests & responses
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

const chargePoints: Record<string, ChargePoint> = {};
const idTags: string[] = [];
const transactions: Record<string, { chargePointId: string, connectorId: number, idTag: string }> = {};

app.get('/charge-points', (_, res) => {
  res.json(Object.keys(chargePoints));
});

app.get('/charge-points/:chargePointId/number-of-connectors', async (req, res) => {
  const chargePointId = req.params.chargePointId;
  if (chargePointId in chargePoints) {
    res.type('text/plain').send(JSON.stringify({
      numberOfConnectors: parseInt(await chargePoints[chargePointId].getNumConnectors(), 10)
    }));
  } else {
    res.status(404).send('Charge point not found');
  }
});

app.get('/id-tags', (_, res) => {
  res.json(idTags);
});

app.post('/id-tags', (_, res) => {
  const idTag = nanoid(20);
  idTags.push(idTag);
  res.json({ idTag });
});

app.post('/transactions', async (req, res) => {
  const { chargePointId, connectorId, idTag } = req.body;

  if (chargePoints[chargePointId]) {
    const response = await chargePoints[chargePointId].startTransaction({ connectorId, idTag });
    console.log('response', response);
    const transactionId = nanoid();
    transactions[transactionId] = { chargePointId, connectorId, idTag };
    res.json({ transactionId });
  } else {
    res.status(404).send('Charge point not found');
  }
});

app.get('/local-list/:chargePointId/version', async (req, res) => {
  const chargePointId = req.params.chargePointId;
  if (chargePoints[chargePointId]) {
    res.json({
      localListVersion: await chargePoints[chargePointId].getLocalListVersion()
    });
  } else {
    res.status(404).send('Charge point not found');
  }
});

app.get('/configuration/:chargePointId', async (req, res) => {
  const chargePointId = req.params.chargePointId;
  if (chargePoints[chargePointId]) {
    res.json({
      configuration: await chargePoints[chargePointId].getConfiguration()
    });
  } else {
    res.status(404).send('Charge point not found');
  }
});

app.post('/configuration', (req, res) => {
  const contentType = req.get('content-type');

  if (contentType === 'application/x-www-form-urlencoded') {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields) => {
      if (err) {
        res.status(500).send('Internal server error');
        return;
      }

      const { chargePointId, key, value } = fields;
      if (chargePoints[chargePointId as string]) {
        await chargePoints[chargePointId as string].setConfiguration(key as string, value);
        res.send('OK');
      } else {
        res.status(404).send('Charge point not found');
      }
    });
  } else {
    res.send('Config set');
  }
});

app.get('/', (_, res) => {
  res.sendFile('index.html');
});

app.use((_, res) => {
  console.log('404 Error: Page not found');
  res.status(404).send('Sorry, page not found');
});

server.on('upgrade', rpcServer.handleUpgrade);

rpcServer.on('client', async (client: RPCClient) => {
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

  // handle StartTransaction requests
  client.handle('StartTransaction', ({ params }) => {
    // the charging station has started a transaction and wants to inform the server.
    console.log(`Server got StartTransaction from ${client.identity}:`, params);

    return {
      idTagInfo: {
        status: 'Accepted', // idTag accepted
      },
      transactionId: 1, // the transactionId should relate to a record stored somewhere in your back-end
    };
  });

  // create a wildcard handler to handle any RPC method
  client.handle(({ method, params }) => {
    // This handler will be called if the incoming method cannot be handled elsewhere.
    console.log(`Server got ${method} from ${client.identity}:`, JSON.stringify(params, null, 2));

    // throw an RPC error to inform the server that we don't understand the request.
    throw createRPCError('NotImplemented');
  });
});

server.listen(9000, () => {
  console.log('Server listening on port 9000');
});
