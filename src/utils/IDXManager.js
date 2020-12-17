import { IDX } from "@ceramicstudio/idx";
import { providers, utils } from "ethers";
import { PrivateKey, ThreadID, Client, Where } from "@textile/hub";
import { createDefinition, publishSchema } from "@ceramicstudio/idx-tools";
import { BigNumber } from "bignumber.js";
let fetching = false;
let idx = null;
let db = null;
let id = null;
let threadId = null;
// @ts-ignore

export const ethBuildSchema = {
  $id: "https://example.com/ethBuild.schema.json",
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ethBuild",
  type: "object",
  required: ["_id"],
  properties: {
    _id: {
      type: "string",
      description: "The instance's id.",
    },
    idxDid: {
      type: "string",
      description: "User's IDX DID.",
    },
    fileName: {
      type: "string",
      description: "The filename",
    },
    content: {
      type: "string",
      description: "The content of file",
    },
    screenshot: {
      type: "string",
      description: "The screenshot of file",
    },
  },
};

const IDXSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ethBuildIDXSchema",
  type: "object",
  properties: {
    threadId: {
      type: "string",
      title: "threadId",
      maxLength: 4000,
    },
  },
};

const generateMessageForEntropy = (
  ethereum_address,
  application_name,
  secret
) => {
  return (
    "******************************************************************************** \n" +
    "READ THIS MESSAGE CAREFULLY. \n" +
    "DO NOT SHARE THIS SIGNED MESSAGE WITH ANYONE OR THEY WILL HAVE READ AND WRITE \n" +
    "ACCESS TO THIS APPLICATION. \n" +
    "DO NOT SIGN THIS MESSAGE IF THE FOLLOWING IS NOT TRUE OR YOU DO NOT CONSENT \n" +
    "TO THE CURRENT APPLICATION HAVING ACCESS TO THE FOLLOWING APPLICATION. \n" +
    "******************************************************************************** \n" +
    "The Ethereum address used by this application is: \n" +
    "\n" +
    ethereum_address +
    "\n" +
    "\n" +
    "\n" +
    "By signing this message, you authorize the current application to use the \n" +
    "following app associated with the above address: \n" +
    "\n" +
    application_name +
    "\n" +
    "\n" +
    "\n" +
    "The hash of your non-recoverable, private, non-persisted password or secret \n" +
    "phrase is: \n" +
    "\n" +
    secret +
    "\n" +
    "\n" +
    "\n" +
    "******************************************************************************** \n" +
    "ONLY SIGN THIS MESSAGE IF YOU CONSENT TO THE CURRENT PAGE ACCESSING THE KEYS \n" +
    "ASSOCIATED WITH THE ABOVE ADDRESS AND APPLICATION. \n" +
    "AGAIN, DO NOT SHARE THIS SIGNED MESSAGE WITH ANYONE OR THEY WILL HAVE READ AND \n" +
    "WRITE ACCESS TO THIS APPLICATION. \n" +
    "******************************************************************************** \n"
  );
};

const convertToUint = (s) => {
  var result = [];

  for (var i = 0; i < s.length; i += 2) {
    result.push(parseInt(s.substring(i, i + 2), 16));
  }
  result = Uint8Array.from(result);

  return result;
};

export const openIDX = async (address, provider, setStatus = console.log()) => {
  if (fetching) {
    throw new Error("trying to open 3Box while fetching...");
  }
  fetching = true;
  try {
    if (typeof provider !== "undefined") {
      const { ThreeIdConnect, EthereumAuthProvider } = await import(
        "3id-connect"
      );
      const threeID = new ThreeIdConnect();

      await threeID.connect(new EthereumAuthProvider(provider, address));
      const didProvider = threeID.getDidProvider();
      const Ceramic = await (await import("@ceramicnetwork/http-client"))
        .default;
      const ceramic = new Ceramic("https://ceramic-dev.3boxlabs.com");
      await ceramic.setDIDProvider(didProvider);
      idx = createIDX(ceramic);
      console.log(idx);
      console.log("idx.id", idx.id);

      // const schema = await publishSchema(ceramic, { content: IDXSchema });
      // const definition = await createDefinition(ceramic, {
      //   name: "ethBuildIDX",
      //   description: "ethBuildIDX data",
      //   schema: schema.versionId.toUrl(),
      // });
      // console.log("definition", definition);
      // const seedKey = definition.id.toString();
      // console.log("IDX setup created with definition ID:", seedKey);
      setStatus("IDX space opened");
      return { idx };
    } else {
      throw new Error("No web3 provider available");
    }
  } catch (error) {
    throw error;
  } finally {
    fetching = false;
  }
};

export const generatePrivateKey = async (address, provider) => {
  console.log("provider", provider);
  const signer = new providers.Web3Provider(provider).getSigner();
  console.log("signer", signer);
  // avoid sending the raw secret by hashing it first
  const secret = "mysecret";
  const message = generateMessageForEntropy(address, "textile-demo", secret);
  const signedText = await signer.signMessage(message);
  const hash = utils.keccak256(signedText);
  if (hash === null) {
    throw new Error(
      "No account is provided. Please provide an account to this application."
    );
  }
  // The following line converts the hash in hex to an array of 32 integers.
  console.log("hash", hash);
  console.log("bignumber", BigNumber);

  const array = hash
    .replace("0x", "")
    .match(/.{2}/g)
    .map((hexNoPrefix) => new BigNumber("0x" + hexNoPrefix).toNumber());

  if (array.length !== 32) {
    throw new Error(
      "Hash of signature is not the correct size! Something went wrong!"
    );
  }
  id = PrivateKey.fromRawEd25519Seed(Uint8Array.from(array));
  console.log("identity", id.toString());

  // Your app can now use this identity for generating a user Mailbox, Threads, Buckets, etc
  return id;
};

export const getDBInstance = async () => {
  if (!id) {
    await generatePrivateKey();
  }
  const info = {
    key: "beirz4ccoagkprf7qftycbop25u",
    secret: "bfv5bqccs3npc2pmsga42zrv7hvrfmge2alsyigy",
  };

  db = await Client.withKeyInfo(info);

  await db.getToken(id);
  console.log("idx is ", idx.id.split(":")[2]);

  const data = await idx.get("basicProfile");
  console.log("data is ", data);
  if (data?.userThreadId) {
    console.log("found data");
    threadId = ThreadID.fromString(data.userThreadId);
  } else {
    console.log("not found data");
    threadId = ThreadID.fromRandom();
    console.log("threadId", threadId);
    await db.newDB(threadId);

    const threadIdStr = threadId.toString();
    console.log("threadIdStr", threadIdStr);

    await idx.set("basicProfile", { userThreadId: threadIdStr });
    const data2 = await idx.get("basicProfile");
    console.log(data2, "saaatatdata"); // { my: 'contents' }

    await db.newCollection(threadId, {
      name: "ethBuild",
      schema: ethBuildSchema,
    });
  }
};

export const saveDocumentIDX = async (documentTitle, content, screenshot) => {
  if (!db) {
    await getDBInstance();
  }
  const ids = await db.create(threadId, "ethBuild", [
    {
      _id: "",
      idxDid: idx.id,
      fileName: documentTitle,
      content: content,
      screenshot: screenshot,
    },
  ]);
  console.log(ids, "ids");
  const q = new Where("idxDid").eq(idx.id);
  const r = await db.find(threadId, "ethBuild", q);

  const user_ids = r.map((instance) => instance._id);
  console.log("user Ids", user_ids);
  return ids;
};

export const getSavedDocuments = async () => {
  if (!db) {
    await getDBInstance();
  }
  const q = new Where("idxDid").eq(idx.id);
  const r = await db.find(threadId, "ethBuild", q);
  console.log("user Ids r", r);

  return r;
};

export function createIDX(ceramic) {
  const definitions = {
    ethBuildIDX:
      "kjzl6cwe1jw14a0nhgutcimmqn3tmh58nmx5uz1m8w3mepq476ilxre35yty2lu",
  };
  const idx = new IDX({ aliases: definitions, ceramic });
  return idx;
}

export const logoutIDX = async () => {
  idx = null;
};

export const getIDX = () => idx;
export const getID = () => id;
export const getDB = () => db;
export const isIDXFetching = () => fetching;
