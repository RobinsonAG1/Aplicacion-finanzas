import argparse

from cryptography.fernet import Fernet


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Genera una clave Fernet para WALLET_ENCRYPTION_KEY"
    )
    parser.add_argument("--count", type=int, default=1)
    args = parser.parse_args()
    for _ in range(args.count):
        print(Fernet.generate_key().decode())


if __name__ == "__main__":
    main()
