use std::{
    env,
    fs::File,
    io::{self},
    path::Path,
};

use thumb::ThumbnailInfo;

mod thumb;

fn main() -> io::Result<()> {
    let image_path_str = env::args()
        .nth(1)
        .expect("No filename given, expecting image file.");
    let image_path = Path::new(&image_path_str);

    match image_path.extension() {
        None => std::process::exit(0),
        Some(ext) if ext != "jpg" => std::process::exit(0),
        _ => {}
    }

    let file = File::open(&image_path_str).expect("failed to open file");
    let ThumbnailInfo {
        filename: thumb_filename,
        keywords,
    } = thumb::handle_image(file, image_path);

    println!("Wrote thumbnail to {thumb_filename}");
    println!("Keywords are {}", keywords.join(", "));

    Ok(())
}
