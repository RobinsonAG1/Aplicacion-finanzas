import argparse
import json
import sys
from pathlib import Path

from eth_account import Account as EthAccount
from web3 import Web3

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"
SOL_PATH = CONTRACTS_DIR / "PaymentProcessor.sol"
ARTIFACT_PATH = CONTRACTS_DIR / "PaymentProcessor.json"

# Cuenta prefundificada #0 de Anvil: paga el despliegue en desarrollo.
ANVIL_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
# Cuenta prefundificada #1 de Anvil: treasury por defecto.
ANVIL_TREASURY_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"


def build_artifact() -> dict[str, object]:
    import solcx

    installed = [str(v) for v in solcx.get_installed_solc_versions()]
    version = "0.8.24"
    if version not in installed:
        solcx.install_solc(version)
    compiled = solcx.compile_source(
        SOL_PATH.read_text(encoding="utf-8"),
        output_values=["abi", "bin"],
        solc_version=version,
        optimize=True,
        optimize_runs=200,
    )
    _, data = next(iter(compiled.items()))
    return {"contractName": "PaymentProcessor", "abi": data["abi"], "bytecode": data["bin"]}


def main() -> None:
    parser = argparse.ArgumentParser(description="Despliega PaymentProcessor contra un nodo EVM")
    parser.add_argument("--rpc", default="http://127.0.0.1:8545")
    parser.add_argument("--treasury", default=ANVIL_TREASURY_ADDRESS)
    parser.add_argument(
        "--private-key", default=ANVIL_DEPLOYER_KEY, help="clave que paga el despliegue"
    )
    args = parser.parse_args()

    if not ARTIFACT_PATH.exists():
        artifact = build_artifact()
        ARTIFACT_PATH.write_text(json.dumps(artifact, indent=2), encoding="utf-8")
        print(f"artifact generado en {ARTIFACT_PATH}")
    else:
        artifact = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))

    w3 = Web3(Web3.HTTPProvider(args.rpc))
    if not w3.is_connected():
        sys.exit(f"no se pudo conectar a {args.rpc}; levanta Anvil primero")

    account = EthAccount.from_key(args.private_key)
    balance_eth = w3.from_wei(w3.eth.get_balance(account.address), "ether")
    print(f"desplegando desde {account.address} (saldo {balance_eth} ETH, chain {w3.eth.chain_id})")

    factory = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    tx = factory.constructor(Web3.to_checksum_address(args.treasury)).build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 700_000,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    receipt_status: int = int(receipt["status"])
    if receipt_status != 1:
        sys.exit("el despliegue fue revertido en la cadena")

    contract_address = receipt["contractAddress"]
    print(f"contrato desplegado en {contract_address} (bloque {receipt['blockNumber']})")
    print()
    print("Agrega estas variables a backend/.env:")
    print(f"RPC_URL={args.rpc}")
    print(f"CHAIN_ID={w3.eth.chain_id}")
    print(f"PAYMENT_CONTRACT_ADDRESS={contract_address}")
    print(f"TREASURY_ADDRESS={Web3.to_checksum_address(args.treasury)}")
    print("WALLET_ENCRYPTION_KEY=<clave Fernet generada con scripts/generate_wallet_key.py>")


if __name__ == "__main__":
    main()
