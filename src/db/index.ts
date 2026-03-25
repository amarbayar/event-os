import { createConnection } from "./connection";

const { db } = await createConnection();

export { db };
