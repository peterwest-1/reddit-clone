import argon2 from "argon2";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from "type-graphql";
import { v4 } from "uuid";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { User } from "../entities/User";
import { sendEmail } from "../utils/sendEmail";
import { validateRegister } from "../utils/validateRegister";
// import { EntityManager } from "@mikro-orm/postgresql";
import { UsernamePasswordInput } from "./UsernamePasswordInput";

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() { req, em }: MyContext) {
    if (!req.session.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });
    return user;
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }

    const hashedPassword = await argon2.hash(options.password);

    //NOT CURRENTLY WORKING
    // let user;
    // try {
    //   const result = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
    //     username: options.username,
    //     email: options.email,
    //     password: hashedPassword,
    //     createdAt: new Date(),
    //     updatedAt: new Date(),
    //   }).returning("*")

    //   user = result[0];
    // }

    const user = em.create(User, {
      username: options.username,
      email: options.email,
      createdAt: new Date(),
      updatedAt: new Date(),
      password: hashedPassword,
    });
    try {
      await em.persistAndFlush(user);
    } catch (error) {
      if (error.code == "23505" || error.detail.includes("already exists")) {
        return {
          errors: [
            {
              field: "username",
              message: "username already taken",
            },
          ],
        };
      }
      console.error(error.message);
    }
    req.session.userId = user.id;
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(
      User,
      usernameOrEmail.includes("@")
        ? { email: usernameOrEmail }
        : { username: usernameOrEmail }
    );
    if (!user) {
      return {
        errors: [
          { field: "usernameOrEmail", message: "username does not exist" },
        ],
      };
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [{ field: "password", message: "password does not match" }],
      };
    }

    req.session.userId = user.id;

    return {
      user,
    };
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { em,redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 2) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "length must be greater than 2",
          },
        ],
      };
    }
    const key = FORGET_PASSWORD_PREFIX + token
    const userId = await redis.get(key);
    if (!userId) {
      //Potentially handle token manipulation, probs not worth though
      return {
        errors: [
          {
            field: "token",
            message: "invalid or expired token",
          },
        ],
      };
    }
    const user = await em.findOne(User, {id: parseInt(userId)})

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    user.password = await argon2.hash(newPassword);
    await em.persistAndFlush(user);
    await redis.del(key);

    //log user in 
    req.session.userId = user.id;

    return {user};
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      //Email Not Found
      //Forgot password should not say whether or not a email exists on the database
      //Security reasons, prevents
      // "If the email exists, we'll send it to that emai"
      return true;
    }

    const token = v4();
    //value for 2 days
    await redis.set(
      FORGET_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 2
    );

    sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">Change Password</a>`
    );
    return true;
  }
}
