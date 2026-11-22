use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, Signer, SigningKey};
use rand_core::OsRng;
use std::{fs, path::Path};
#[cfg(windows)]
use windows::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB;
use zeroize::Zeroize;

pub struct Identity {
    signing_key: SigningKey,
}

impl Identity {
    pub fn load_or_create(directory: &Path) -> Result<Self, String> {
        let path = directory.join("identity.key");
        if path.exists() {
            let protected = fs::read(&path).map_err(|error| error.to_string())?;
            let mut secret = unprotect(&protected)?;
            let bytes: [u8; 32] = secret
                .as_slice()
                .try_into()
                .map_err(|_| "Identidade local inválida.".to_string())?;
            let key = SigningKey::from_bytes(&bytes);
            secret.zeroize();
            Ok(Self { signing_key: key })
        } else {
            let signing_key = SigningKey::generate(&mut OsRng);
            let protected = protect(signing_key.as_bytes())?;
            fs::write(&path, protected).map_err(|error| error.to_string())?;
            Ok(Self { signing_key })
        }
    }

    pub fn public_key(&self) -> String {
        URL_SAFE_NO_PAD.encode(self.signing_key.verifying_key().as_bytes())
    }

    pub fn sign(&self, challenge: &[u8]) -> Result<String, String> {
        if !(12..=256).contains(&challenge.len()) || challenge.iter().all(|byte| *byte == 0) {
            return Err(
                "O desafio deve ser efêmero, ter entre 12 e 256 bytes e não ser vazio.".into(),
            );
        }
        let signature: Signature = self.signing_key.sign(challenge);
        Ok(URL_SAFE_NO_PAD.encode(signature.to_bytes()))
    }
}

#[cfg(windows)]
fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData};
    crypt(data, true, |input, output| unsafe {
        CryptProtectData(
            input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            output,
        )
    })
}

#[cfg(windows)]
fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    use windows::Win32::Security::Cryptography::{CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData};
    crypt(data, false, |input, output| unsafe {
        CryptUnprotectData(
            input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            output,
        )
    })
}

#[cfg(windows)]
fn crypt(
    data: &[u8],
    _protecting: bool,
    operation: impl FnOnce(
        *const CRYPT_INTEGER_BLOB,
        *mut CRYPT_INTEGER_BLOB,
    ) -> windows::core::Result<()>,
) -> Result<Vec<u8>, String> {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};
    use windows::Win32::Security::Cryptography::CRYPT_INTEGER_BLOB;
    let input = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    operation(&input, &mut output).map_err(|error| error.to_string())?;
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        let _ = LocalFree(Some(HLOCAL(output.pbData as *mut _)));
    }
    Ok(result)
}

#[cfg(not(windows))]
fn protect(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("A identidade protegida está disponível somente no Windows.".into())
}

#[cfg(not(windows))]
fn unprotect(_data: &[u8]) -> Result<Vec<u8>, String> {
    Err("A identidade protegida está disponível somente no Windows.".into())
}
