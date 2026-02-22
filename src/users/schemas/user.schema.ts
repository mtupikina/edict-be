import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

const READ_ONLY_MESSAGE =
  'User collection is read-only in this application; updates are not allowed.';

export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, enum: UserRole })
  role: UserRole;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Block all write operations: this app may only read user data.
UserSchema.pre(
  'save',
  function (this: UserDocument, next: (err?: Error) => void) {
    next(new Error(READ_ONLY_MESSAGE));
  },
);

UserSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
  ],
  function (next: (err?: Error) => void) {
    next(new Error(READ_ONLY_MESSAGE));
  },
);
