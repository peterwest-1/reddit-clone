import { ApolloServer } from "apollo-server-express";
import { ApolloServerPluginLandingPageGraphQLPlayground } from "apollo-server-core";
import cors from "cors";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { COOKIE_NAME, __prod__ } from "./constants";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import path from "path"

const main = async () => {

   const connection = await createConnection({
    type: 'postgres',
    database: 'reddit-clone-database',
    username: 'postgres',
    password: 'PrettyLights1',
    logging: !__prod__,
    synchronize: true,
    migrations: [
      path.join(__dirname, "./migrations/*")
    ],
    entities:[
      User, Post
    ]
  })

  await connection.runMigrations();

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
      secret: String(process.env.SESSION_SECRET) ,
      resave: false,
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
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
      redis
    }),
    plugins:[
      ApolloServerPluginLandingPageGraphQLPlayground
    ]
  });
  
  await apolloServer.start();

  apolloServer.applyMiddleware({ app, cors: false});
  app.listen(4000, () => {
    console.info("Server started on http://localhost:%s", 4000);
  });
};



main().catch((error) => {
  console.error(error);
});
