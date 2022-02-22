import argon2 from "argon2";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  ObjectType,
  Query,
  Resolver
} from "type-graphql";
import { User } from "../entities/User";

@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;

  @Field()
  password: string;
}

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

  @Query(()=> User, { nullable: true})
  async me(
    @Ctx(){req, em}: MyContext) {
      if(!req.session.userId){
        return null;
      }

      const user = await em.findOne(User, {id: req.session.userId});
      return user
    }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    if (options.username.length <= 2) {
      return {
        errors: [{ field: "username", message: "username is not long enough" }],
      };
    }

    if (options.password.length <= 8) {
      return {
        errors: [
          {
            field: "password",
            message: "password is not long enough 8",
          },
        ],
      };
    }

    const hasedPassword = await argon2.hash(options.password);
    const user = em.create(User, {
      username: options.username,
      createdAt: new Date(),
      updatedAt: new Date(),
      password: hasedPassword,
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
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req}: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });
    if (!user) {
      return {
        errors: [{ field: "username", message: "username does not exist" }],
      };
    }

    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [{ field: "password", message: "password does not match" }],
      };
    }

    req.session.userId = user.id;

    return {
      user
    };
  }
}
