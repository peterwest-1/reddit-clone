import { __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { MikroORM } from "@mikro-orm/core";
import path from "path";
import { User } from "./entities/User";
require('dotenv').config();
export default {
    entities: [Post, User],
    dbName: "reddit-clone-database",
    type: "postgresql",
    debug: !__prod__,
    password: process.env.DB_PASSWORD,
    migrations: {
        path: path.join(__dirname, './migrations'), // path to the folder with migrations
        glob: '!(*.d).{js,ts}', // how to match migration files (all .js and .ts files, but not .d.ts)
    }
} as Parameters<typeof MikroORM.init>[0];


//  user: "postgres",
// password: "PrettyLights1",