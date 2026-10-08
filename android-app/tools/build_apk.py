#!/usr/bin/env python3
"""Rebuild a development-signed APK with official Android tools, no Gradle required."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT=Path(__file__).resolve().parents[1]
ANDROID='http://schemas.android.com/apk/res/android'
ET.register_namespace('android',ANDROID)

def run(args):
    subprocess.run([str(a) for a in args],check=True)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sdk=os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME')
    parser.add_argument('--build-tools',type=Path,default=Path(sdk)/'build-tools/36.0.0' if sdk else None)
    parser.add_argument('--android-jar',type=Path,default=Path(sdk)/'platforms/android-36/android.jar' if sdk else None)
    parser.add_argument('--ecj',type=Path,help='Optional Eclipse compiler JAR when javac is unavailable')
    parser.add_argument('--verify-only',action='store_true',help='Recompile source and compare with the signed APK without signing credentials')
    args=parser.parse_args()
    if not args.build_tools or not args.android_jar:parser.error('Set ANDROID_SDK_ROOT or provide --build-tools and --android-jar.')
    tools=args.build_tools.resolve();jar=args.android_jar.resolve()
    for file in (jar,tools/'aapt2',tools/'d8',tools/'zipalign',tools/'apksigner'):
        if not file.is_file():parser.error('Missing Android tool: '+str(file))
    if not args.verify_only and not os.environ.get('AERION_DEVELOPMENT_STORE_PASSWORD'):parser.error('Set AERION_DEVELOPMENT_STORE_PASSWORD for the existing development certificate.')
    build=ROOT/'build/cli';dist=ROOT/'dist'
    if build.exists():shutil.rmtree(build)
    build.mkdir(parents=True);dist.mkdir(exist_ok=True)
    gen=build/'generated';gen.mkdir();classes=build/'classes';classes.mkdir();dex=build/'dex';dex.mkdir()
    tree=ET.parse(ROOT/'app/src/main/AndroidManifest.xml');manifest=tree.getroot()
    manifest.set('package','in.zebjus.aerion');manifest.set('{'+ANDROID+'}versionCode','1836602');manifest.set('{'+ANDROID+'}versionName','18.3.66-android.2')
    sdk_node=ET.Element('uses-sdk',{'{'+ANDROID+'}minSdkVersion':'26','{'+ANDROID+'}targetSdkVersion':'36'});manifest.insert(0,sdk_node)
    tree.write(build/'AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
    run([tools/'aapt2','compile','--dir',ROOT/'app/src/main/res','-o',build/'resources.zip'])
    run([tools/'aapt2','link','-I',jar,'--manifest',build/'AndroidManifest.xml','--java',gen,'--min-sdk-version','26','--target-sdk-version','36','-A',ROOT/'app/src/main/assets','-o',build/'resources.apk',build/'resources.zip'])
    sources=sorted((ROOT/'app/src/main/java').rglob('*.java'))+sorted(gen.rglob('*.java'))
    compiler=['java','-jar',args.ecj.resolve()] if args.ecj else (['javac'] if shutil.which('javac') else ['java','com.sun.tools.javac.Main'])
    boot=str(jar)+os.pathsep+str(tools/'core-lambda-stubs.jar')
    run(compiler+['-source','8','-target','8','-bootclasspath',boot,'-d',classes]+sources)
    with zipfile.ZipFile(build/'classes.jar','w') as z:
        for p in classes.rglob('*.class'):z.write(p,p.relative_to(classes))
    run([tools/'d8','--min-api','26','--lib',jar,'--output',dex,build/'classes.jar'])
    shutil.copyfile(build/'resources.apk',build/'unsigned.apk')
    with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
        for p in dex.glob('*.dex'):z.write(p,p.name)
    run([tools/'zipalign','-f','-p','4',build/'unsigned.apk',build/'aligned.apk'])
    apk=dist/'ZEBJUS_Aerion_V18_3_66_Android.apk'
    if args.verify_only:
        with zipfile.ZipFile(build/'unsigned.apk') as rebuilt,zipfile.ZipFile(apk) as signed:
            expected=set(rebuilt.namelist())
            actual={n for n in signed.namelist() if not n.startswith('META-INF/')}
            if expected!=actual:raise RuntimeError('Rebuilt source and signed APK entry lists differ')
            for name in expected:
                if rebuilt.read(name)!=signed.read(name):raise RuntimeError('Source/APK byte mismatch: '+name)
    else:
        key=ROOT/'signing/aerion-development.p12'
        if not key.is_file():run(['keytool','-genkeypair','-noprompt','-storetype','PKCS12','-keystore',key,'-storepass:env','AERION_DEVELOPMENT_STORE_PASSWORD','-keypass:env','AERION_DEVELOPMENT_STORE_PASSWORD','-alias','aerion-development','-keyalg','RSA','-keysize','3072','-validity','3650','-dname','CN=Aerion Development, OU=Development, O=ZEBJUS, C=IN'])
        run([tools/'apksigner','sign','--ks',key,'--ks-pass','env:AERION_DEVELOPMENT_STORE_PASSWORD','--ks-key-alias','aerion-development','--min-sdk-version','26','--v4-signing-enabled','false','--out',apk,build/'aligned.apk'])
    verify=subprocess.run([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(apk)],check=True,capture_output=True,text=True).stdout
    (dist/'APK_SIGNATURE.txt').write_text(verify)
    badging=subprocess.run([str(tools/'aapt2'),'dump','badging',str(apk)],check=True,capture_output=True,text=True).stdout
    (dist/'APK_MANIFEST.txt').write_text(badging)
    run([tools/'zipalign','-c','-p','4',apk])
    with zipfile.ZipFile(apk) as z:
        assert z.testzip() is None and 'classes.dex' in z.namelist()
        assert z.read('assets/flight/index.html')==(ROOT/'app/src/main/assets/flight/index.html').read_bytes()
        assert z.read('assets/android-transport.js')==(ROOT/'app/src/main/assets/android-transport.js').read_bytes()
    assert "package: name='in.zebjus.aerion'" in badging and "minSdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging
    report={'product':'ZEBJUS Aerion Flight','version':'18.3.66-android.2','versionCode':1836602,'package':'in.zebjus.aerion','minSdk':26,'targetSdk':36,'signing':'development key, included for development updates; not a private production key','apkBytes':apk.stat().st_size,'sha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'verification':['APK ZIP integrity','DEX compiled','manifest/package/minSDK/targetSDK','v2/v3 APK signature','4-byte ZIP alignment','bundled UI/transport exact byte equality'],'androidDeviceTested':False,'physicalDroneTested':False}
    (dist/'BUILD_REPORT.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
