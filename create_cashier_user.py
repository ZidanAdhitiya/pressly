"""Provision a cashier account without exposing account creation over HTTP."""
from getpass import getpass

from operator_database import create_cashier_user


def main() -> None:
    username = input("Nama akun kasir: ").strip()
    display_name = input("Nama kasir: ").strip()
    password = getpass("Password baru (minimal 10 karakter): ")
    confirmation = getpass("Ulangi password: ")
    if password != confirmation:
        raise SystemExit("Password tidak sama; akun tidak dibuat.")
    user = create_cashier_user(username, display_name, password)
    print(f"Akun kasir {user['username']} berhasil dibuat. Password tidak disimpan dalam teks biasa.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        raise SystemExit(str(error)) from error
