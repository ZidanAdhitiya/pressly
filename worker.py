"""Compatibility entry point: layout processing is synchronous in the local app."""

if __name__ == "__main__":
    print("Fazima Print tidak memakai worker queue; proses layout dilakukan langsung oleh operator.")
