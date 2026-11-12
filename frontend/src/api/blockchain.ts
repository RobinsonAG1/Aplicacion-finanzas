import { apiRequest } from './client'

export type OnChainPaymentStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED'

export interface ChainStatus {
  enabled: boolean
  chainId: number
  contractAddress: string | null
  treasuryAddress: string | null
  latestBlock: number | null
  indexerInterval: number
}

export interface Wallet {
  id: string
  address: string
  chainId: number
  balanceEth: string
  createdAt: string
}

export interface OnChainPayment {
  id: string
  reference: string
  amountEth: string
  amountWei: string
  status: OnChainPaymentStatus
  transactionId: string | null
  txHash: string | null
  blockNumber: number | null
  gasUsed: number | null
  errorMessage: string | null
  confirmedAt: string | null
  createdAt: string
}

export interface ChainEvent {
  id: string
  eventName: string
  reference: string
  payer: string
  amountEth: string
  amountWei: string
  blockNumber: number
  txHash: string
  logIndex: number
  createdAt: string
}

export interface PaymentInput {
  amount: string
  transactionId?: string
}

export const blockchainApi = {
  async status(): Promise<ChainStatus> {
    const result = await apiRequest<{ data: ChainStatus }>('/blockchain/status')
    return result.data
  },
  async getWallet(): Promise<Wallet> {
    const result = await apiRequest<{ data: Wallet }>('/blockchain/wallet')
    return result.data
  },
  async createWallet(): Promise<Wallet> {
    const result = await apiRequest<{ data: Wallet }>('/blockchain/wallet', {
      method: 'POST',
    })
    return result.data
  },
  async listPayments(limit = 50): Promise<OnChainPayment[]> {
    const result = await apiRequest<{ data: OnChainPayment[] }>(
      `/blockchain/payments?limit=${limit}`,
    )
    return result.data
  },
  async createPayment(input: PaymentInput): Promise<OnChainPayment> {
    const result = await apiRequest<{ data: OnChainPayment }>('/blockchain/payments', {
      method: 'POST',
      body: input,
    })
    return result.data
  },
  async listEvents(limit = 100): Promise<ChainEvent[]> {
    const result = await apiRequest<{ data: ChainEvent[] }>(
      `/blockchain/events?limit=${limit}`,
    )
    return result.data
  },
}
