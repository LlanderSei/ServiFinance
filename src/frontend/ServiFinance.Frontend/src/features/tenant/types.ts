export type CreateUserRequest = {
  fullName: string;
  email: string;
  password: string;
  roleIds: string[];
};

export type UpdateUserRequest = {
  fullName: string;
  roleIds: string[];
};
