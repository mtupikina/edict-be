import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

import { Permission } from './permission.schema';
import { Role } from './role.schema';

export type RolePermissionDocument = RolePermission & Document;

/** Same collection as edict-admin-be (`role_permissions`). */
@Schema({ collection: 'role_permissions', timestamps: true })
export class RolePermission {
  @Prop({ type: Types.ObjectId, ref: Role.name, required: true })
  roleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: Permission.name, required: true })
  permissionId: Types.ObjectId;
}

export const RolePermissionSchema =
  SchemaFactory.createForClass(RolePermission);
RolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });
