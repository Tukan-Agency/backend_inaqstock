import User, { IUser } from "../../model/userModel";
import redis from "../config/redisClient";

const TTL_SECONDS = 300;

export const getRedisKey = {
  email: (email: string) => `user:${email.trim().toLowerCase()}`,
  id: (id: string) => `user:id:${id}`,
};

// Purga de cache (id y/o email)
export const purgeUserCache = async (params: { id?: string; email?: string }) => {
  const jobs: Promise<any>[] = [];
  if (params.id) jobs.push(redis.del(getRedisKey.id(params.id)));
  if (params.email) jobs.push(redis.del(getRedisKey.email(params.email)));
  if (jobs.length) await Promise.allSettled(jobs);
};

// GET por Email
export const getUserByEmail = async (email: string): Promise<IUser | null> => {
  const key = getRedisKey.email(email);
  const cached = await redis.get(key);

  if (cached) {
    const user = JSON.parse(cached) as IUser;
    return user;
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).lean();
  if (user) {
    await redis.set(key, JSON.stringify(user), "EX", TTL_SECONDS);
    await redis.set(getRedisKey.id(user._id.toString()), JSON.stringify(user), "EX", TTL_SECONDS);
  }
  return user;
};

// GET por ID
export const getUserById = async (id: string): Promise<IUser | null> => {
  const key = getRedisKey.id(id);
  const cached = await redis.get(key);

  if (cached) {
    return JSON.parse(cached) as IUser;
  }

  const user = await User.findById(id).lean();
  if (user) {
    await redis.set(key, JSON.stringify(user), "EX", TTL_SECONDS);
    await redis.set(getRedisKey.email(user.email), JSON.stringify(user), "EX", TTL_SECONDS);
  }
  return user;
};

// CREAR usuario
export const createUser = async (data: Partial<IUser>): Promise<IUser> => {
  const user = await User.create(data);
  const leanUser = user.toObject() as IUser & { _id: string };

  // Guardar en Redis
  await redis.set(getRedisKey.email(leanUser.email), JSON.stringify(leanUser), "EX", TTL_SECONDS);
  await redis.set(getRedisKey.id(leanUser._id.toString()), JSON.stringify(leanUser), "EX", TTL_SECONDS);

  return leanUser;
};

// ACTUALIZAR usuario
export const updateUser = async (id: string, updates: Partial<IUser>): Promise<IUser | null> => {
  const user = await User.findByIdAndUpdate(id, updates, { new: true }).lean();
  if (!user) return null;

  // Invalidar y refrescar caché
  await purgeUserCache({ id, email: user.email });

  await redis.set(getRedisKey.email(user.email), JSON.stringify(user), "EX", TTL_SECONDS);
  await redis.set(getRedisKey.id(id), JSON.stringify(user), "EX", TTL_SECONDS);

  return user;
};