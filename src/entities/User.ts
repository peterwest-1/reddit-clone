import { Field, Int, ObjectType } from "type-graphql";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, BaseEntity, OneToMany } from "typeorm";
import { Post } from "./Post";
import { Upvote } from "./Upvote";

@ObjectType()
@Entity()
export class User extends BaseEntity {

    //Identification fields
    @Field(() => Int)
    @PrimaryGeneratedColumn()
    id!: number;
   
    @Field()
    @Column({ unique: true})
    username!: string;

    @Field()
    @Column({ unique: true})
    email!: string;

    //Note: No field property, cant be queried I think
    @Column()
    password!: string;

    //Posts
    @OneToMany(()=> Post, posts => posts.creator)
    posts: Post[];

    @OneToMany(()=> Upvote, upvote => upvote.user)
    upvotes: Upvote[];

    //Create And Update Fields
    @Field(() => String)
    @CreateDateColumn()
    createdAt: Date;

    @Field(() => String)
    @UpdateDateColumn()
    updatedAt: Date;

    //run yarn create:migration after the file was updated
}