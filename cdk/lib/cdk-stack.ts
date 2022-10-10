import * as cdk from "aws-cdk-lib";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { CfnOutput, aws_iam as iam, aws_ec2 as ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";
// import { readFileSync } from "fs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

const getString = (s: string | undefined): string => {
  return s === undefined ? "" : s;
};

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ssh public key
    const publicKeyMaterial = process.env.SSH_PUB_KEY;
    if (publicKeyMaterial === undefined) {
      throw new Error(`SSH_PUB_KEY environment variable not defined`);
      return;
    }

    // VPC
    const vpc = new ec2.Vpc(this, "vpc", {
      //cidr: "10.1.0.0/21",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      maxAzs: 99,
    });

    // SecurityGroup
    const mySG = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      description: "Allow ssh access to ec2 instances",
      allowAllOutbound: true, // Can be set to false
    });
    mySG.addIngressRule(
      ec2.Peer.ipv4(getString(process.env.MYIP)),
      ec2.Port.tcp(22),
      "ssh access from home"
    );
    mySG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.udpRange(26900, 26902),
      "7dtd port"
    );
    mySG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(26900, 26902),
      "7dtd port"
    );
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(28082), "LinuxGSM");
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allIcmp(), "icmp");
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "http");
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "https");

    // IAM policy
    const policy = new iam.ManagedPolicy(this, "EC2Policy", {
      description: "",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "sqs:DeleteMessage",
            "sqs:ChangeMessageVisibility",
            "kms:Decrypt",
            "dynamodb:PutItem",
            "dynamodb:DeleteItem",
            "sqs:ReceiveMessage",
            "sqs:SendMessage",
            "dynamodb:GetItem",
            "route53:ChangeResourceRecordSets",
            "ssm:GetParametersByPath",
            "dynamodb:UpdateItem",
            "ssm:GetParameters",
            "ssm:GetParameter",
          ],
          resources: [
            "arn:aws:sqs:*:*:DiscordBotStack-Queue*",
            "arn:aws:kms:*:*:key/CMK",
            "arn:aws:ssm:*:*:parameter/7dtd*",
            "arn:aws:dynamodb:*:*:table/DiscordBotStack-Table*",
            "arn:aws:route53:::hostedzone/*",
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ["ec2:DisassociateAddress", "ec2:AssociateAddress"],
          resources: ["*"],
        }),
      ],
    });
    // IAM rule
    const fleetSpotRole = new iam.Role(this, "spotfleetRole", {
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2SpotFleetTaggingRole"),
      ],
      assumedBy: new iam.ServicePrincipal("spotfleet.amazonaws.com"),
      path: "/",
    });
    // IAM rule
    const ec2role = new iam.Role(this, "EC2Role", {
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ReadOnlyAccess"),
        policy,
      ],
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      path: "/",
    });

    // ssh key pair
    const keyPair = new ec2.CfnKeyPair(this, "MyCfnKeyPair", {
      keyName:`${this.stackName}KeyPair`,
      publicKeyMaterial: publicKeyMaterial,
    });

    //const userDataScript = readFileSync('./lib/user-data.sh', 'utf8');
    const setupCommands = ec2.UserData.forLinux();
    const asset = new Asset(this, "Asset", { path: "./lib/user-data.sh" });
    const localPath = setupCommands.addS3DownloadCommand({
      bucket: asset.bucket,
      bucketKey: asset.s3ObjectKey,
    });
    setupCommands.addExecuteFileCommand({ filePath: localPath });
    asset.grantRead(ec2role);

    const multipartUserData = new ec2.MultipartUserData();
    // Execute the rest of setup
    multipartUserData.addPart(ec2.MultipartBody.fromUserData(setupCommands));

    const launchTemplateName = `${this.stackName}Template`;
    const template = new ec2.LaunchTemplate(this, "template", {
      userData: multipartUserData,
      keyName: keyPair.keyName,
      //machineImage: ec2.MachineImage.latestAmazonLinux(),
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/ami-amazon-linux-latest/al2022-ami-kernel-default-x86_64"
      ),
      /*
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2022,
        edition: ec2.AmazonLinuxEdition.STANDARD,
        kernel: ec2.AmazonLinuxKernel
        //virtualization: ec2.AmazonLinuxVirt.HVM,
        //storage: ec2.AmazonLinuxStorage.GENERAL_PURPOSE,
      }),
      */
      launchTemplateName: launchTemplateName,
      securityGroup: mySG,
      role: ec2role,
    });

    const subnets = vpc.publicSubnets.map((d): string => {return d.subnetId})
    const cfnSpotFleet = new ec2.CfnSpotFleet(this, 'soptFleet', {
      spotFleetRequestConfigData: {
        iamFleetRole: fleetSpotRole.roleArn,
        allocationStrategy: 'lowestPrice',
        terminateInstancesWithExpiration: false,
        targetCapacity: 0,
        type: 'maintain',
        targetCapacityUnitType: 'units',
        onDemandAllocationStrategy: 'lowestPrice',
        launchTemplateConfigs: [
          {
            launchTemplateSpecification: {
              launchTemplateId: getString(template.launchTemplateId),
              version: template.latestVersionNumber,
            },
            overrides: [{
              subnetId: subnets.join(','),
              instanceRequirements: {
                vCpuCount: {
                  max: 4,
                  min: 2,
                },
                memoryMiB: {
                  min: 7168,
                  max: 16384,
                },
              },
            }],
          }
        ],
      },
    });

    new CfnOutput(this, "keyPairName", { value: keyPair.keyName });
    new CfnOutput(this, "roleARN", { value: ec2role.roleArn });
    new CfnOutput(this, "SecurityGroupID", { value: mySG.securityGroupId });
    new CfnOutput(this, "LaunchTemplateID", { value: getString(template.launchTemplateId) });
    new CfnOutput(this, "LaunchTemplateVersion", {
      value: template.versionNumber,
    });
    new CfnOutput(this, "cfnSpotFleetID", {
      value: cfnSpotFleet.attrId,
    });
  }
}
