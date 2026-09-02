import base32 from 'hi-base32';

// Browser-compatible TOTP verification using WebCrypto API + hi-base32
// Generates same codes as Google Authenticator and otplib
export const verify6DigitCode = async (totpSecret, code) => {
  try {
    // Decode the Base32 secret using hi-base32 decoder (matches Google Authenticator)
    const secretBytes = new Uint8Array(base32.decode.asBytes(totpSecret));

    // Get current time counter (30-second window)
    const now = Math.floor(Date.now() / 1000);
    const timeCounter = Math.floor(now / 30);

    // Check current and previous/next windows for tolerance
    const windows = [timeCounter - 1, timeCounter, timeCounter + 1];
    
    for (let window of windows) {
      // Generate TOTP code for this window
      const generatedTotp = await generateTOTPCode(secretBytes, window);
      
      if (generatedTotp === code) {
        return true;
      }
    }

    return false;
  } catch (err) {
    return false;
  }
};

// Helper: Generate TOTP code for a specific time window using WebCrypto API
const generateTOTPCode = async (secretBytes, window) => {
  // Create counter buffer (8 bytes, big-endian) representing the time window
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new Uint8Array(counterBuffer);
  
  // Write 64-bit big-endian counter
  const windowBigInt = BigInt(window);
  for (let i = 0; i < 8; i++) {
    counterView[i] = Number((windowBigInt >> BigInt((7 - i) * 8)) & BigInt(0xff));
  }

  // Generate HMAC-SHA1 signature
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, counterBuffer);
  const signatureBytes = new Uint8Array(signature);

  // Extract TOTP value (dynamic truncation per RFC 4226)
  const offset = signatureBytes[19] & 0x0f;
  const otp =
    ((signatureBytes[offset] & 0x7f) << 24) |
    ((signatureBytes[offset + 1] & 0xff) << 16) |
    ((signatureBytes[offset + 2] & 0xff) << 8) |
    (signatureBytes[offset + 3] & 0xff);

  // Return 6-digit code
  const totp = (otp % 1000000).toString().padStart(6, "0");
  return totp;
};

// Debug: Convert bytes back to hex string to verify decoding
export const bytesToHex = (bytes) => {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Generate TOTP secret locally (Base32 encoded)
// Standard: generate 20 random bytes, then Base32 encode
export const generateTOTPSecret = () => {
  // Generate 20 random bytes (160 bits) - standard for TOTP
  const randomBytes = new Uint8Array(20);
  crypto.getRandomValues(randomBytes);
  
  // Encode using hi-base32 for consistency with decoder
  const secret = base32.encode(randomBytes);
  
  return secret;
};