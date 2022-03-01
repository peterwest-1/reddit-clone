import { Entity, PrimaryKey, Property,  } from "@mikro-orm/core";
import { Field, Int, ObjectType } from "type-graphql";

@ObjectType()
@Entity()
export class User {

    @Field(() => Int)
    @PrimaryKey()
    id!: number;
    
    @Field(() => String)
    @Property({type: 'date'})
    createdAt = new Date();

    @Field(() => String)
    @Property({type: 'date', onUpdate: () => new Date()})
    updatedAt = new Date();

    @Field()
    @Property({type: 'text', unique: true})
    username!: string;

    @Field()
    @Property({type: 'text', unique: true})
    email!: string;

    //No field property, cant be queried I think
    @Property({type: 'text'})
    password!: string;



    //run yarn create:migration after the file was updated
}