import { MikroORM } from "@mikro-orm/core";
import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { COOKIE_NAME, __prod__ } from "./constants";
import microConfig from "./mikro-orm.config";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
const main = async () => {

  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();
 
  let RedisStore = require("connect-redis")(session)
  const redis = new Redis();
  


  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  )

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      saveUninitialized: false,
      secret: "QWERTY",
      resave: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 3
        httpOnly: true,
        sameSite: "lax",
        secure: __prod__, // does not work in local // https
      },
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => ({
      req,
      res,
      redis,
      em: orm.em,
    }),
  });
  
  await apolloServer.start();

  // apolloServer.applyMiddleware({ app});
  apolloServer.applyMiddleware({ app, cors: false});
  app.listen(4000, () => {
    console.info("Server started on http://localhost:%s", 4000);
  });
};



main().catch((error) => {
  console.error(error);
});
