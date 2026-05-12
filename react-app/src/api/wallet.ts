import { api } from "./client";

export async function deposit(amount: number, paymentMethod: string): Promise<{ newBalance: number }> {
  const { data } = await api.post<{ newBalance: number }>("/wallet/deposit", { amount, paymentMethod });
  return data;
}

export async function withdraw(amount: number): Promise<{ newBalance: number }> {
  const { data } = await api.post<{ newBalance: number }>("/wallet/withdraw", { amount });
  return data;
}
