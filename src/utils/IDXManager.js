import { IDX } from '@ceramicstudio/idx'

let fetching = false;
let idx = null;
// @ts-ignore

export const openIDX = async (
  address,
  provider,
  setStatus = console.log()
) => {
  if (fetching) {
    throw new Error("trying to open 3Box while fetching...");
  }
  fetching = true;
  try {
    if (typeof provider !== "undefined") {
      const { ThreeIdConnect, EthereumAuthProvider } = await import('3id-connect')
      const threeID = new ThreeIdConnect()

      await threeID.connect(new EthereumAuthProvider(provider, address))
      const didProvider = threeID.getDidProvider()
      const Ceramic = await (await import("@ceramicnetwork/http-client")).default;
      const ceramic = new Ceramic('https://ceramic-dev.3boxlabs.com')
      await ceramic.setDIDProvider(didProvider)
      idx = createIDX(ceramic)
      console.log(idx)
      
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


export function createIDX(ceramic) {
  const idx = new IDX({ ceramic })
  return idx
}

export const logoutIDX = async () => {
  idx = null;
};

export const getIDX = () => idx;
export const isFetching = () => fetching;
