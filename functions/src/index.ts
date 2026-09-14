import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";
import { submitGameAction } from "./games/submitGameAction";

initializeApp();

setGlobalOptions({
  region: "europe-west1",
  enforceAppCheck: true,
  maxInstances: 10,
});

export { submitGameAction };
