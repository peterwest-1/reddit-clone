import { MyContext } from "../types";
import {
  Arg,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  Ctx,
  UseMiddleware,
  Int,
  FieldResolver,
  Root,
  ObjectType,
} from "type-graphql";
import { Post } from "../entities/Post";
import { isAuthenticated } from "../middleware/isAuthenticated";
import { getConnection } from "typeorm";
import { Upvote } from "../entities/Upvote";
import { User } from "../entities/User";

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];

  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @FieldResolver(() => Int, { nullable: true })
  async voteStatus(
    @Root() post: Post,
    @Ctx() { upvoteLoader, req }: MyContext
  ) {
    if (!req.session.userId) {
      return null;
    }
    const upvote = await upvoteLoader.load({
      postId: post.id,
      userId: req.session.userId,
    });

    return upvote ? upvote.value : null;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuthenticated)
  async vote(
    @Arg("postId", () => Int) postId: number,
    @Arg("value", () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpvote = value !== -1;
    const _value = isUpvote ? 1 : -1;
    const { userId } = req.session;

    const upvote = await Upvote.findOne({ where: { postId, userId } });

    // the user has voted on the post before
    // and they are changing their vote
    if (upvote && upvote.value !== _value) {
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
    update upvote
    set value = $1
    where "postId" = $2 and "userId" = $3
        `,
          [_value, postId, userId]
        );

        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2
        `,
          [2 * _value, postId]
        );
      });
    } else if (!upvote) {
      // has never voted before
      await getConnection().transaction(async (tm) => {
        await tm.query(
          `
    insert into upvote ("userId", "postId", value)
    values ($1, $2, $3)
        `,
          [userId, postId, _value]
        );

        await tm.query(
          `
    update post
    set points = points + $1
    where id = $2
      `,
          [_value, postId]
        );
      });
    }
    return true;
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg("limit", () => Int) limit: number,
    @Arg("cursor", () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const maxLimit = Math.min(50, limit);
    const maxLimitPlusOne = maxLimit + 1;

    const replacements: any[] = [maxLimitPlusOne];

    if (cursor) {
      replacements.push(new Date(parseInt(cursor)));
    }

    const posts = await getConnection().query(
      `
    select p.*
    from post p
    ${cursor ? `where p."createdAt" < $2` : ""}
    order by p."createdAt" DESC
    limit $1
    `,
      replacements
    );

    return {
      posts: posts.slice(0, maxLimit),
      hasMore: posts.length === maxLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg("id", () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuthenticated)
  async createPost(
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post> {
    return Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuthenticated)
  async updatePost(
    @Arg("id", () => Int) id: number,
    @Arg("input") input: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const title = input.title;
    const text = input.text;
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning("*")
      .execute();

    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuthenticated)
  async deletePost(
    @Arg("id", () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    /*
    const post = await Post.findOne(id);

    if (!post) {
      return false;
    }

    if (post.creatorId !== req.session.userId) {
      throw new Error("not authorized");
    }

    await Upvote.delete({ postId: id });
    */
    await Post.delete({ id, creatorId: req.session.userId });

    //Cascading
    //, creatorId: req.session.userId

    return true;
  }
}
