use image::{DynamicImage, ImageOutputFormat, RgbImage};
use jpeg_decoder::{Decoder, PixelFormat};
use std::{
    env,
    fs::File,
    io::{self, BufReader, ErrorKind, Read},
};

fn main() -> io::Result<()> {
    static DEFAULT_FILE: &str = "tests/data/ahma.jpg";
    let image_path = env::args()
        .nth(1)
        .unwrap_or_else(|| DEFAULT_FILE.to_owned());

    if !image_path.ends_with(".jpg") {
        std::process::exit(0);
    }

    let file = File::open(&image_path).expect("failed to open file");
    let mut decoder = Decoder::new(BufReader::new(file));
    let image_data = decoder.decode().expect("Decoding error");

    let metadata = decoder
        .info()
        .expect("No metadata in image, can't get image dimensions.");

    if metadata.pixel_format != PixelFormat::RGB24 {
        todo!("Only RGB24 pixel format is supported.");
    }

    let img: DynamicImage =
        RgbImage::from_raw(metadata.width as u32, metadata.height as u32, image_data)
            .expect("Image doesn't fit in it's own data?")
            .into();

    let mut out_file = File::create("thumb.jpg").expect("Failed to create thumbnail file.");
    img.thumbnail(600, 600)
        .write_to(&mut out_file, ImageOutputFormat::Jpeg(96))
        .expect("Error on file save");

    println!("Wrote thumbnail as a file.");

    let keywords: Vec<_> = decoder
        .photoshop_irb()
        .iter()
        .filter_map(|data| parse_keywords_from_photoshop_irb_data(data).ok())
        .flatten()
        .collect();

    println!("Keywords are: {}", keywords.join(", "));

    Ok(())
}

fn read_be_u32(input: &mut &[u8]) -> u32 {
    let (int_bytes, rest) = input.split_at(std::mem::size_of::<u32>());
    *input = rest;
    u32::from_be_bytes(int_bytes.try_into().unwrap())
}

fn read_be_u16(input: &mut &[u8]) -> u16 {
    let (int_bytes, rest) = input.split_at(std::mem::size_of::<u16>());
    *input = rest;
    u16::from_be_bytes(int_bytes.try_into().unwrap())
}

fn parse_keywords_from_photoshop_irb_data(data: &[u8]) -> std::io::Result<Vec<String>> {
    let mut keywords = vec![];

    let mut index = 0;
    while index < data.len() {
        let marker = &data[index..index + 4];
        if marker == b"8BIM" {
            index += 4;
            let identifier = &data[index..index + 2];
            index += 2;
            let name_length = data[index] as usize;
            index += 1;

            if name_length > 0 {
                index += name_length;
            }
            if name_length % 2 == 0 {
                index += 1;
            }
            let data_length = read_be_u32(&mut &data[index..index + 4]) as usize;
            index += 4;
            if identifier == b"\x04\x04" {
                let iptc_data = &data[index..index + data_length];
                keywords.extend(parse_keywords_from_iptc_iim(iptc_data)?.into_iter());
            }
            index += data_length;
            if data_length % 2 != 0 {
                index += 1;
            }
        } else {
            return Err(std::io::Error::from(ErrorKind::InvalidData));
        }
    }
    Ok(keywords)
}

fn parse_keywords_from_iptc_iim(data: &[u8]) -> io::Result<Vec<String>> {
    let mut reader = data;
    let mut keywords: Vec<String> = vec![];

    while !reader.is_empty() {
        let mut tag_marker = [0u8; 1];
        reader.read_exact(&mut tag_marker)?;
        if tag_marker == [28] {
            let mut record_set = [0u8, 0];
            reader.read_exact(&mut record_set)?;
            let mut data_length = [0u8, 0];
            reader.read_exact(&mut data_length)?;
            if data_length[0] & 0b10000000 > 0 {
                todo!("Extended DataSet Tag not implemented yet")
            }
            let mut data = vec![0; read_be_u16(&mut &data_length[0..]) as usize];
            reader.read_exact(&mut data)?;

            // ESC, %, G is the sequence for UTF-8
            if record_set == [1, 90] && data != [b'\x1b', b'%', b'G'] {
                todo!("UTF-8 is the only supported character set.")
            } else if record_set == [2, 25] {
                keywords.push(String::from_utf8_lossy(&data).into_owned());
            }
        } else {
            println!("Tag marker wasn't 28, it was {}", tag_marker[0]);
        }
    }
    Ok(keywords)
}

fn _print_bytes(bytes: &[u8]) {
    for (i, byte) in bytes.iter().enumerate() {
        let chr = char::from(*byte);
        let chr_str = if chr.is_control() {
            format!("0x{byte:02x}")
        } else {
            format!("{chr}")
        };
        println!("{i:02x} {byte:03} {byte:02x} {byte:08b} {chr_str}",);
    }
}
