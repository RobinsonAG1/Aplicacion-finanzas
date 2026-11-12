import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { blockchainApi } from '../api/blockchain'
import type {
  ChainEvent,
  ChainStatus,
  OnChainPayment,
  OnChainPaymentStatus,
  Wallet,
} from '../api/blockchain'
import { ApiError } from '../api/client'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatDate } from '../lib/dates'
import { errorMessage } from '../lib/errors'

const POLL_INTERVAL_MS = 8000
const MAX_PAYMENT_ETH = 100

const STATUS_LABELS: Record<OnChainPaymentStatus, string> = {
  PENDING: 'En mempool',
  SUBMITTED: 'Difundido',
  CONFIRMED: 'Confirmado',
  FAILED: 'Fallido',
}

function statusBadgeClass(status: OnChainPaymentStatus): string {
  if (status === 'CONFIRMED') return 'badge badge-ok'
  if (status === 'FAILED') return 'badge badge-danger'
  return 'badge badge-warn'
}

function truncateHash(value: string, chars = 12): string {
  if (value.length <= chars * 2) return value
  return `${value.slice(0, chars)}…${value.slice(-6)}`
}

export function BlockchainPage() {
  const loadStatus = useCallback(() => blockchainApi.status(), [])
  const { data: status, reload: reloadStatus } = useAsyncData<ChainStatus>(loadStatus)
  const enabled = status?.enabled ?? false

  const loadWallet = useCallback(async (): Promise<Wallet | null> => {
    if (!enabled) return null
    try {
      return await blockchainApi.getWallet()
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }
  }, [enabled])
  const { data: wallet, error: walletError, reload: reloadWallet } = useAsyncData<
    Wallet | null
  >(loadWallet)
  const hasWallet = wallet !== null

  const loadPayments = useCallback(async (): Promise<OnChainPayment[]> => {
    if (!enabled || !hasWallet) return []
    return blockchainApi.listPayments()
  }, [enabled, hasWallet])
  const { data: payments, error: paymentsError, reload: reloadPayments } = useAsyncData<
    OnChainPayment[]
  >(loadPayments)

  const loadEvents = useCallback(async (): Promise<ChainEvent[]> => {
    if (!enabled || !hasWallet) return []
    return blockchainApi.listEvents()
  }, [enabled, hasWallet])
  const { data: events, error: eventsError, reload: reloadEvents } = useAsyncData<
    ChainEvent[]
  >(loadEvents)

  const [amount, setAmount] = useState('')
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [walletActionError, setWalletActionError] = useState<string | null>(null)
  const [creatingWallet, setCreatingWallet] = useState(false)
  const [sending, setSending] = useState(false)

  const hasOpenPayments = (payments ?? []).some(
    (payment) => payment.status === 'PENDING' || payment.status === 'SUBMITTED',
  )

  useEffect(() => {
    // Los pagos pasan de difundido a confirmado en el indexador: refrescamos
    // periódicamente mientras haya pagos en curso.
    if (!enabled || !hasOpenPayments) return
    const timer = window.setInterval(() => {
      void reloadPayments()
      void reloadEvents()
      void reloadStatus()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [enabled, hasOpenPayments, reloadPayments, reloadEvents, reloadStatus])

  async function handleCreateWallet(): Promise<void> {
    setCreatingWallet(true)
    setWalletActionError(null)
    try {
      await blockchainApi.createWallet()
      await reloadWallet()
      await reloadPayments()
      await reloadEvents()
    } catch (err) {
      setWalletActionError(errorMessage(err, 'No se pudo crear la billetera'))
    } finally {
      setCreatingWallet(false)
    }
  }

  async function handlePay(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setSending(true)
    setPaymentError(null)
    try {
      await blockchainApi.createPayment({ amount })
      setAmount('')
      await reloadPayments()
      await reloadEvents()
    } catch (err) {
      setPaymentError(errorMessage(err, 'No se pudo enviar el pago'))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1>Blockchain</h1>
          <p className="muted">
            Pagos on-chain firmados con tu billetera y confirmados en la red.
          </p>
        </div>
        {status && (
          <span className={status.enabled ? 'badge badge-ok' : 'badge'}>
            {status.enabled
              ? `Red conectada · chain ${status.chainId}`
              : 'Sección no configurada'}
          </span>
        )}
      </div>

      {status && !status.enabled && (
        <div className="panel panel-standalone">
          <p className="alert">
            Esta sección requiere un nodo RPC y el contrato de pagos desplegado. Define
            en el backend las variables <span className="mono">RPC_URL</span>,{' '}
            <span className="mono">PAYMENT_CONTRACT_ADDRESS</span>,{' '}
            <span className="mono">TREASURY_ADDRESS</span> y{' '}
            <span className="mono">WALLET_ENCRYPTION_KEY</span>.
          </p>
        </div>
      )}

      {walletError && <p className="alert">{walletError}</p>}
      {walletActionError && <p className="alert">{walletActionError}</p>}

      {status?.enabled && (
        <div className="blockchain-grid">
          <div className="blockchain-stack">
            <div className="panel panel-standalone">
              <h2>Billetera</h2>
              {hasWallet && wallet ? (
                <dl className="chain-meta">
                  <div className="chain-meta-row">
                    <dt>Dirección</dt>
                    <dd>
                      <span className="mono">{truncateHash(wallet.address, 10)}</span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void navigator.clipboard?.writeText(wallet.address)}
                      >
                        Copiar
                      </button>
                    </dd>
                  </div>
                  <div className="chain-meta-row">
                    <dt>Saldo</dt>
                    <dd>
                      <strong>{Number(wallet.balanceEth).toFixed(4)} ETH</strong>
                    </dd>
                  </div>
                  <div className="chain-meta-row">
                    <dt>Creada</dt>
                    <dd>{formatDate(wallet.createdAt)}</dd>
                  </div>
                </dl>
              ) : (
                <div>
                  <p className="muted">
                    No tienes una billetera asociada. Crea una para firmar pagos
                    on-chain; la clave privada se guarda cifrada en el servidor.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleCreateWallet()}
                    disabled={creatingWallet}
                  >
                    {creatingWallet ? 'Creando…' : 'Crear billetera'}
                  </button>
                </div>
              )}
            </div>

            {hasWallet && (
              <form
                className="panel panel-standalone form-panel"
                onSubmit={(event) => void handlePay(event)}
              >
                <h2>Nuevo pago on-chain</h2>
                {paymentError && <p className="alert">{paymentError}</p>}
                <label className="field">
                  Monto (ETH)
                  <input
                    type="number"
                    min="0.000001"
                    max={String(MAX_PAYMENT_ETH)}
                    step="0.000001"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.01"
                    required
                  />
                </label>
                <p className="muted small">
                  La orden pasa por la mempool local y se difunde firmada al nodo; el
                  indexador confirma el recibo unos segundos después.
                </p>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={sending}>
                    {sending ? 'Difundiendo…' : 'Enviar pago'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="blockchain-stack">
            <div className="panel panel-standalone">
              <h2>Estado de la red</h2>
              <dl className="chain-meta">
                <div className="chain-meta-row">
                  <dt>Chain ID</dt>
                  <dd className="mono">{status.chainId}</dd>
                </div>
                <div className="chain-meta-row">
                  <dt>Último bloque</dt>
                  <dd className="mono">{status.latestBlock ?? '—'}</dd>
                </div>
                <div className="chain-meta-row">
                  <dt>Contrato</dt>
                  <dd>
                    {status.contractAddress ? (
                      <span className="mono">{truncateHash(status.contractAddress, 8)}</span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="chain-meta-row">
                  <dt>Tesorería</dt>
                  <dd>
                    {status.treasuryAddress ? (
                      <span className="mono">{truncateHash(status.treasuryAddress, 8)}</span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div className="chain-meta-row">
                  <dt>Indexador</dt>
                  <dd>cada {status.indexerInterval}s</dd>
                </div>
              </dl>
            </div>

            <div className="panel panel-standalone">
              <h2>Pagos</h2>
              {paymentsError && <p className="alert">{paymentsError}</p>}
              {!paymentsError && (payments ?? []).length === 0 && (
                <p className="muted">Aún no has enviado pagos on-chain.</p>
              )}
              {(payments ?? []).length > 0 && (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Monto</th>
                        <th>Tx</th>
                        <th>Bloque</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments ?? []).map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <span className={statusBadgeClass(payment.status)}>
                              {STATUS_LABELS[payment.status]}
                            </span>
                            {payment.errorMessage && (
                              <div className="muted small">{payment.errorMessage}</div>
                            )}
                          </td>
                          <td>{Number(payment.amountEth).toFixed(4)} ETH</td>
                          <td>
                            {payment.txHash ? (
                              <span className="mono">{truncateHash(payment.txHash)}</span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td className="mono">{payment.blockNumber ?? '—'}</td>
                          <td>{formatDate(payment.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel panel-standalone">
              <h2>Eventos indexados</h2>
              {eventsError && <p className="alert">{eventsError}</p>}
              {!eventsError && (events ?? []).length === 0 && (
                <p className="muted">
                  El indexador aún no registra eventos de pagos para tu billetera.
                </p>
              )}
              {(events ?? []).length > 0 && (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Evento</th>
                        <th>Monto</th>
                        <th>Bloque</th>
                        <th>Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(events ?? []).map((chainEvent) => (
                        <tr key={chainEvent.id}>
                          <td>{chainEvent.eventName}</td>
                          <td>{Number(chainEvent.amountEth).toFixed(4)} ETH</td>
                          <td className="mono">{chainEvent.blockNumber}</td>
                          <td>
                            <span className="mono">{truncateHash(chainEvent.txHash)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
