import { apiRequest } from "./client";

export async function deposit(amount: number, paymentMethod: string): Promise<{ newBalance: number }> {
  return apiRequest<{ newBalance: number }>("/wallet/deposit", {
    method: "POST",
    body: { amount, paymentMethod },
    auth: true,
  });
}

export async function withdraw(amount: number): Promise<{ newBalance: number }> {
  return apiRequest<{ newBalance: number }>("/wallet/withdraw", {
    method: "POST",
    body: { amount },
    auth: true,
  });
}
