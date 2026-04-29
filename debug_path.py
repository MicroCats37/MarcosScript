import os

path = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\madreo/image_file_pngtree-decorative-photo-frames-png-image_17126562.jpg"
normalized = os.path.normpath(path)

print(f"Original path: {path}")
print(f"Normalized path: {normalized}")
print(f"Exists? {os.path.exists(normalized)}")
print(f"Is File? {os.path.isfile(normalized)}")

# Let's also check the directory contents again just to be 100% sure
dir_path = r"C:\Users\Usuario\Desktop\Aplicaciones\MarcosScript\madreo"
print(f"\nDirectory {dir_path} contents:")
if os.path.exists(dir_path):
    for f in os.listdir(dir_path):
        print(f"- '{f}'")
        if f.lower() == "image_file_pngtree-decorative-photo-frames-png-image_17126562.jpg":
            print("  ^ MATCH FOUND!")
else:
    print("Directory not found!")
