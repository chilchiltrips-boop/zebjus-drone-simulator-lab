package in.zebjus.aerion;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
/** Pair codes at rest are encrypted with a non-exportable Android Keystore key. */
final class PairingStore {
 private final Context context;PairingStore(Context c){context=c;}
 private SecretKey key()throws Exception{KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);if(!s.containsAlias("zfc-pair-v3")){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("zfc-pair-v3",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (SecretKey)s.getKey("zfc-pair-v3",null);}
 synchronized void save(String id,String code)throws Exception{if(!id.matches("ZFC-[A-Fa-f0-9]{12}")||!code.matches("[A-Fa-f0-9]{32}"))throw new IllegalArgumentException();Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());c.updateAAD(id.getBytes("UTF-8"));byte[] cipher=c.doFinal(code.getBytes("UTF-8"));context.getSharedPreferences("zfc-pair",0).edit().putString(id,Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher,Base64.NO_WRAP)).apply();}
 synchronized String read(String id){try{String[] p=context.getSharedPreferences("zfc-pair",0).getString(id,"").split(":");if(p.length!=2)return "";Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p[0],Base64.NO_WRAP)));c.updateAAD(id.getBytes("UTF-8"));return new String(c.doFinal(Base64.decode(p[1],Base64.NO_WRAP)),"UTF-8");}catch(Exception e){return "";}}
}
