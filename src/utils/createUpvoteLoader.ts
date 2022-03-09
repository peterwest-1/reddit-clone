import DataLoader from "dataloader";
import { Upvote } from "../entities/Upvote";

//[{postId: 1; userId: 2 },]
// [{id: 1, username: "dod"}]
export const createUpvoteLoader = () =>
  new DataLoader<{ postId: number; userId: number }, Upvote | null>(
    async (keys) => {
      const upvotes = await Upvote.findByIds(keys as any);
      const upvoteIdToUpvote: Record<string, Upvote> = {};
      upvotes.forEach((upvote) => {
        upvoteIdToUpvote[`${upvote.userId}|${upvote.postId}`] = upvote;
      });

      return keys.map((key) => upvoteIdToUpvote[`${key.userId}|${key.postId}`]);
    }
  );
