use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::Client;
use bytes::Buf;
use std::{env, path::Path};
use thumb::ThumbnailInfo;

mod thumb;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let image_path_str = env::args()
        .nth(1)
        .expect("No filename given, expecting image file.");
    let image_path = Path::new(&image_path_str);

    match image_path.extension() {
        None => std::process::exit(0),
        Some(ext) if ext != "jpg" => std::process::exit(0),
        _ => {}
    }

    let region_provider = RegionProviderChain::default_provider().or_else("eu-north-1");
    let config = aws_config::from_env().region(region_provider).load().await;
    let client = Client::new(&config);

    let resp = client
        .get_object()
        .bucket("gallery-serverless")
        .key(&image_path_str)
        .send()
        .await
        .map_err(Box::new)?;
    let data = resp.body.collect().await.unwrap().into_bytes().reader();

    let ThumbnailInfo {
        filename: thumb_filename,
        keywords,
    } = thumb::handle_image(data, &image_path_str);

    println!("Wrote thumbnail to {thumb_filename}");
    println!("Keywords are {}", keywords.join(", "));

    Ok(())
}
