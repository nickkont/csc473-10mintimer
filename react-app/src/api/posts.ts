import { api } from "./client";

export interface PostDoc {
  id: string;
  uid: string;
  authorName: string;
  authorInitials: string;
  text: string;
  image: string | null;
  likes: number;
  comments: number;
  createdAt?: { seconds: number; nanoseconds?: number };
}

export async function listPosts(limit = 100): Promise<PostDoc[]> {
  const { data } = await api.get<{ posts: PostDoc[] }>(`/posts?limit=${limit}`);
  return data.posts;
}

export async function createPost(input: {
  text: string;
  image: string | null;
  authorName: string;
  authorInitials: string;
}): Promise<PostDoc> {
  const { data } = await api.post<PostDoc>("/posts", input);
  return data;
}
