import mongoose from "mongoose";
import connectDB from "../database.js";

import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import { WorkItem } from "../models/work-item.model.js";
import { Issue } from "../models/issue.model.js";
import { Initiative } from "../models/initiative.model.js";
import { Resource } from "../models/resource.model.js";
import { ResourceRequirement } from "../models/resource-requirement.model.js";
import { ResourceRequest } from "../models/resource-request.model.js";
import { ContributionOffer } from "../models/contribution-offer.model.js";
import { ResourceReservation } from "../models/resource-reservation.model.js";
import { VolunteerApplication } from "../models/volunteer-application.model.js";
import { ExecutionEvent } from "../models/execution-event.model.js";
import { Notification } from "../models/notification.model.js";

import {
  ACCOUNT_STATUSES,
  APPLICATION_STATUSES,
  DEPENDENCY_TYPES,
  INITIATIVE_STATUSES,
  ISSUE_STATUSES,
  MUNICIPALITY_REVIEW_DECISIONS,
  OFFER_STATUSES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_TYPES,
  READINESS_STATUSES,
  RESOURCE_REQUEST_STATUSES,
  TASK_STATUSES,
  USER_ROLES,
  USER_ROLES_IN_ORGANIZATION,
  VERIFICATION_STATUSES,
} from "../constants/enums.js";

const { ObjectId } = mongoose.Types;
const SEED_PREFIX = "SYN-SEED-2026-";
const d = (v) => new Date(v);
const oid = () => new ObjectId();
const s = (v) => v?.toString();

const loc = (address, district, city, lng, lat) => ({
  address,
  district,
  city,
  country: "Lebanon",
  coordinates: { type: "Point", coordinates: [lng, lat] },
});

const requireUser = (map, email) => {
  const user = map.get(email);
  if (!user) throw new Error(`Required seed user ${email} was not found.`);
  return user;
};

const assertAccountType = (user, expected) => {
  if (user.accountType !== expected) {
    throw new Error(`Seed user ${user.email} has accountType "${user.accountType}", expected "${expected}".`);
  }
};

const setMemberships = async (user, memberships) => {
  const desiredIds = new Set(memberships.map((m) => s(m.organizationId)));
  const preserved = user.memberships.filter((m) => !desiredIds.has(s(m.organizationId)));
  const next = [
    ...preserved,
    ...memberships.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      status: ACCOUNT_STATUSES.ACTIVE,
      joinedAt: d("2026-08-01T08:00:00Z"),
    })),
  ];
  const ids = next.map((m) => s(m.organizationId));
  if (ids.length !== new Set(ids).size) throw new Error(`Duplicate membership would be created for ${user.email}.`);
  user.memberships = next;
  await user.save();
};

const org = ({ type, name, suffix, description, email, phone, line, city, coordinates }) => ({
  organizationType: type,
  name,
  description,
  registrationNumber: `${SEED_PREFIX}${suffix}`,
  verificationStatus: VERIFICATION_STATUSES.VERIFIED,
  status: ORGANIZATION_STATUSES.ACTIVE,
  contact: { email, phone, websiteUrl: null },
  address: { line, city, region: "North Lebanon", countryCode: "LB", locationType: "Point", coordinates },
});

const phase = (_id, name, order, status, start = null, end = null) => ({
  _id,
  name,
  description: `${name} phase for seeded workflow testing.`,
  order,
  status,
  scheduledStartAt: start ? d(start) : undefined,
  scheduledEndAt: end ? d(end) : undefined,
});

const task = ({ _id, title, phaseId, order, status, orgId, deps = [], skills = [], slots = 0, progress = 0, locked = true, lockReasons = [], completedBy = null, actualStartAt = null, completedAt = null }) => ({
  _id,
  title,
  description: `${title} is a realistic seeded task used for Syntria workflow and dependency testing.`,
  phaseId,
  order,
  status,
  dependencies: deps,
  assignedOrganization: orgId,
  requiredSkills: skills,
  volunteerSlots: slots,
  completedBy,
  progress,
  actualStartAt: actualStartAt ? d(actualStartAt) : null,
  completedAt: completedAt ? d(completedAt) : null,
  isLocked: locked,
  lockReasons,
});

const req = ({ _id, initiative, category, name, quantity, unit, cost = null, from = null, until = null, area = null, verified = false, reopenedAt = null }) => ({
  _id,
  initiative,
  category,
  name,
  description: `${name} requirement created for realistic Syntria resource coordination testing.`,
  quantityRequired: quantity,
  quantityReserved: 0,
  unit,
  estimatedCost: cost,
  currency: "USD",
  requiredFrom: from ? d(from) : null,
  requiredUntil: until ? d(until) : null,
  serviceArea: area,
  status: "unmet",
  isVerifiedRequest: verified,
  reopenedAt: reopenedAt ? d(reopenedAt) : null,
});

const notification = ({ recipient, type, title, message, entityType, entityId, url, deliveredAt, readAt = null }) => ({
  recipient,
  type,
  title,
  message,
  relatedEntity: entityType ? { entityType, entityId } : undefined,
  actionUrl: url,
  deliveredAt: deliveredAt ? d(deliveredAt) : null,
  readAt: readAt ? d(readAt) : null,
});

const syncRequirementCaches = async (deliveredIds = new Set()) => {
  const reservations = await ResourceReservation.find({});
  const counted = new Map();
  for (const r of reservations) {
    if (!["active", "fulfilled"].includes(r.status)) continue;
    counted.set(s(r.resourceRequirement), (counted.get(s(r.resourceRequirement)) ?? 0) + r.quantity);
  }
  const requirements = await ResourceRequirement.find({});
  for (const r of requirements) {
    const q = counted.get(s(r._id)) ?? 0;
    if (q > r.quantityRequired) throw new Error(`Requirement ${r._id} is over-reserved.`);
    r.quantityReserved = q;
    if (deliveredIds.has(s(r._id))) {
      if (q !== r.quantityRequired) throw new Error(`Delivered requirement ${r._id} is not fully allocated.`);
      r.status = "delivered";
    } else if (q === 0) r.status = "unmet";
    else if (q < r.quantityRequired) r.status = "partially_met";
    else r.status = "fully_reserved";
    await r.save();
  }
};

const validateRelationships = async () => {
  const [initiatives, requirements, resources, requests, offers, reservations, applications] = await Promise.all([
    Initiative.find({}), ResourceRequirement.find({}), Resource.find({}), ResourceRequest.find({}),
    ContributionOffer.find({}), ResourceReservation.find({}), VolunteerApplication.find({}),
  ]);
  const initMap = new Map(initiatives.map((x) => [s(x._id), x]));
  const reqMap = new Map(requirements.map((x) => [s(x._id), x]));
  const resMap = new Map(resources.map((x) => [s(x._id), x]));
  const requestMap = new Map(requests.map((x) => [s(x._id), x]));
  const offerMap = new Map(offers.map((x) => [s(x._id), x]));

  for (const r of requirements) if (!initMap.has(s(r.initiative))) throw new Error(`Requirement ${r._id} has missing initiative.`);

  for (const x of requests) {
    const r = reqMap.get(s(x.resourceRequirement));
    const resource = resMap.get(s(x.resource));
    if (!r || !resource) throw new Error(`Request ${x._id} has missing relationship.`);
    if (s(r.initiative) !== s(x.initiative)) throw new Error(`Request ${x._id} requirement belongs to another initiative.`);
    if (s(resource.ownerOrganization) !== s(x.partnerOrganization)) throw new Error(`Request ${x._id} resource owner mismatch.`);
    if (x.unit !== r.unit) throw new Error(`Request ${x._id} unit mismatch.`);
  }

  for (const x of offers) for (const item of x.items) {
    const r = reqMap.get(s(item.resourceRequirement));
    const resource = resMap.get(s(item.resource));
    if (!r || !resource) throw new Error(`Offer ${x._id} has missing relationship.`);
    if (s(r.initiative) !== s(x.initiative)) throw new Error(`Offer ${x._id} requirement belongs to another initiative.`);
    if (s(resource.ownerOrganization) !== s(x.partnerOrganization)) throw new Error(`Offer ${x._id} resource owner mismatch.`);
    if (item.unit !== r.unit) throw new Error(`Offer ${x._id} unit mismatch.`);
  }

  for (const x of reservations) {
    const r = reqMap.get(s(x.resourceRequirement));
    if (!r || s(r.initiative) !== s(x.initiative)) throw new Error(`Reservation ${x._id} requirement mismatch.`);
    const hasReq = Boolean(x.resourceRequest), hasOffer = Boolean(x.contributionOffer);
    if (hasReq === hasOffer) throw new Error(`Reservation ${x._id} must have exactly one source.`);
    if (hasReq) {
      const src = requestMap.get(s(x.resourceRequest));
      if (!src || s(src.initiative) !== s(x.initiative) || s(src.resourceRequirement) !== s(x.resourceRequirement) || s(src.resource) !== s(x.resource)) {
        throw new Error(`Reservation ${x._id} does not match ResourceRequest source.`);
      }
    } else {
      const src = offerMap.get(s(x.contributionOffer));
      const item = src?.items.id(x.contributionOfferItemId);
      if (!src || !item || s(src.initiative) !== s(x.initiative) || s(item.resourceRequirement) !== s(x.resourceRequirement) || s(item.resource) !== s(x.resource)) {
        throw new Error(`Reservation ${x._id} does not match ContributionOffer source.`);
      }
    }
  }

  for (const init of initiatives) {
    const taskIds = new Set(init.tasks.map((t) => s(t._id)));
    for (const t of init.tasks) {
      if (!init.phases.id(t.phaseId)) throw new Error(`Task ${t._id} references invalid phase.`);
      for (const dep of t.dependencies) {
        if (dep.type === DEPENDENCY_TYPES.TASK && (!taskIds.has(s(dep.taskId)) || s(dep.taskId) === s(t._id))) throw new Error(`Task ${t._id} has invalid task dependency.`);
        if (dep.type === DEPENDENCY_TYPES.RESOURCE) {
          const r = reqMap.get(s(dep.resourceRequirement));
          if (!r || s(r.initiative) !== s(init._id)) throw new Error(`Task ${t._id} has invalid resource dependency.`);
        }
      }
    }
  }

  for (const a of applications) {
    const init = initMap.get(s(a.initiative));
    if (!init?.tasks.id(a.taskId)) throw new Error(`VolunteerApplication ${a._id} taskId is not inside its initiative.`);
  }

  const countedReservations = reservations.filter((x) => ["active", "fulfilled"].includes(x.status));
  const totals = new Map();
  for (const x of countedReservations) totals.set(s(x.resourceRequirement), (totals.get(s(x.resourceRequirement)) ?? 0) + x.quantity);
  for (const r of requirements) if (r.quantityReserved !== (totals.get(s(r._id)) ?? 0)) throw new Error(`Requirement ${r._id} quantityReserved cache mismatch.`);

  /* Verify every counted reservation fits a declared availability window. */
  for (const x of countedReservations) {
    const resource = resMap.get(s(x.resource));
    if (!resource) throw new Error(`Reservation ${x._id} references a missing resource.`);
    const coveringWindow = resource.availabilityWindows.find((w) =>
      w.startAt <= x.reservedFrom && w.endAt >= x.reservedUntil && w.availableQuantity >= x.quantity
    );
    if (!coveringWindow) throw new Error(`Reservation ${x._id} is outside resource ${resource._id} availability or window quantity.`);
  }

  /* Sweep overlapping counted reservations so no resource is overbooked. */
  for (const resource of resources) {
    const events = [];
    for (const x of countedReservations.filter((r) => s(r.resource) === s(resource._id))) {
      events.push({ at: x.reservedFrom.getTime(), delta: x.quantity, order: 1 });
      events.push({ at: x.reservedUntil.getTime(), delta: -x.quantity, order: 0 });
    }
    events.sort((a, b) => a.at - b.at || a.order - b.order);
    let allocated = 0;
    for (const event of events) {
      allocated += event.delta;
      if (allocated > resource.totalQuantity) throw new Error(`Resource ${resource._id} is overbooked: ${allocated} > ${resource.totalQuantity}.`);
    }
  }

  console.log("Final relationship and availability validation passed.");
};

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log("Connected to MongoDB.");

    const emails = [
      "ahmad.municipality@syntria.test", "layla.municipality@syntria.test",
      "rana.greenfuture@syntria.test", "samer.greenfuture@syntria.test",
      "nour.communitycare@syntria.test", "karim.multiorg@syntria.test",
      "maya.equipment@syntria.test", "joseph.equipment@syntria.test", "dalia.medical@syntria.test",
      "omar.member@syntria.test", "sara.member@syntria.test", "tarek.member@syntria.test",
    ];

    const users = await User.find({ email: { $in: emails } }).select("+password");
    const byEmail = new Map(users.map((u) => [u.email, u]));
    emails.forEach((email) => requireUser(byEmail, email));

    const ahmad = requireUser(byEmail, emails[0]), layla = requireUser(byEmail, emails[1]);
    const rana = requireUser(byEmail, emails[2]), samer = requireUser(byEmail, emails[3]);
    const nour = requireUser(byEmail, emails[4]), karim = requireUser(byEmail, emails[5]);
    const maya = requireUser(byEmail, emails[6]), joseph = requireUser(byEmail, emails[7]), dalia = requireUser(byEmail, emails[8]);
    const omar = requireUser(byEmail, emails[9]), sara = requireUser(byEmail, emails[10]), tarek = requireUser(byEmail, emails[11]);

    [[ahmad,USER_ROLES.MUNICIPALITY],[layla,USER_ROLES.MUNICIPALITY],[rana,USER_ROLES.COMMUNITY_ORGANIZATION],[samer,USER_ROLES.COMMUNITY_ORGANIZATION],[nour,USER_ROLES.COMMUNITY_ORGANIZATION],[karim,USER_ROLES.COMMUNITY_ORGANIZATION],[maya,USER_ROLES.RESOURCE_PARTNER],[joseph,USER_ROLES.RESOURCE_PARTNER],[dalia,USER_ROLES.RESOURCE_PARTNER],[omar,USER_ROLES.COMMUNITY_MEMBER],[sara,USER_ROLES.COMMUNITY_MEMBER],[tarek,USER_ROLES.COMMUNITY_MEMBER]].forEach(([u,t]) => assertAccountType(u,t));

    const oldSeedOrgs = await Organization.find({ registrationNumber: { $regex: `^${SEED_PREFIX}` } }).select("_id");
    const oldIds = oldSeedOrgs.map((x) => x._id);
    if (oldIds.length) {
      const usersWithOldSeedMemberships = await User.find({
        "memberships.organizationId": { $in: oldIds },
      }).select("+password");

      for (const user of usersWithOldSeedMemberships) {
        user.memberships = user.memberships.filter(
          (membership) => !oldIds.some((organizationId) => s(organizationId) === s(membership.organizationId)),
        );
        await user.save();
      }
    }

    await Notification.deleteMany({});
    await ExecutionEvent.deleteMany({});
    await VolunteerApplication.deleteMany({});
    await ResourceReservation.deleteMany({});
    await ResourceRequest.deleteMany({});
    await ContributionOffer.deleteMany({});
    await ResourceRequirement.deleteMany({});
    await Resource.deleteMany({});
    await WorkItem.deleteMany({});
    if (oldIds.length) await Organization.deleteMany({ _id: { $in: oldIds } });

    const organizations = await Organization.create([
      org({ type:ORGANIZATION_TYPES.MUNICIPALITY,name:"Tripoli Municipality",suffix:"MUN-TRIPOLI",description:"Municipal authority coordinating civic initiatives and issue response in Tripoli.",email:"civic@tripoli.syntria.test",phone:"+961 6 410000",line:"Municipal Palace",city:"Tripoli",coordinates:[35.8497,34.4367] }),
      org({ type:ORGANIZATION_TYPES.MUNICIPALITY,name:"Mina Municipality",suffix:"MUN-MINA",description:"Municipal authority serving Mina and nearby coastal neighborhoods.",email:"civic@mina.syntria.test",phone:"+961 6 610000",line:"Mina Municipal Building",city:"Mina",coordinates:[35.8137,34.4512] }),
      org({ type:ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION,name:"Green Future NGO",suffix:"CO-GREEN",description:"Environmental NGO coordinating cleanup, greening, and awareness initiatives.",email:"contact@greenfuture.syntria.test",phone:"+961 70 100101",line:"Azmi Street",city:"Tripoli",coordinates:[35.8395,34.4338] }),
      org({ type:ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION,name:"Community Care Association",suffix:"CO-CARE",description:"Community organization supporting health and neighborhood assistance programs.",email:"contact@communitycare.syntria.test",phone:"+961 70 100102",line:"Maarad Street",city:"Tripoli",coordinates:[35.8452,34.4351] }),
      org({ type:ORGANIZATION_TYPES.COMMUNITY_ORGANIZATION,name:"Youth Impact Lebanon",suffix:"CO-YOUTH",description:"Youth-led organization supporting volunteering, education, and resilience programs.",email:"contact@youthimpact.syntria.test",phone:"+961 70 100103",line:"Mina Main Road",city:"Mina",coordinates:[35.8188,34.4491] }),
      org({ type:ORGANIZATION_TYPES.RESOURCE_PARTNER,name:"North Equipment Partners",suffix:"RP-EQUIP",description:"Partner providing equipment, vehicles, containers, and operational support.",email:"ops@northequipment.syntria.test",phone:"+961 70 200201",line:"Industrial Zone",city:"Tripoli",coordinates:[35.8812,34.4145] }),
      org({ type:ORGANIZATION_TYPES.RESOURCE_PARTNER,name:"Lebanon Medical Supplies",suffix:"RP-MED",description:"Partner providing first aid materials and community medical support teams.",email:"ops@medicalsupplies.syntria.test",phone:"+961 70 200202",line:"Health Services District",city:"Tripoli",coordinates:[35.841,34.4312] }),
      org({ type:ORGANIZATION_TYPES.RESOURCE_PARTNER,name:"Community Logistics Group",suffix:"RP-LOG",description:"Partner providing logistics, transport, venues, water tankers, and funding support.",email:"ops@communitylogistics.syntria.test",phone:"+961 70 200203",line:"Port Logistics Area",city:"Mina",coordinates:[35.8065,34.4571] }),
    ]);
    const [tripoli, mina, green, care, youth, equip, medical, logistics] = organizations;

    await setMemberships(ahmad,[{organizationId:tripoli._id,role:USER_ROLES_IN_ORGANIZATION.OWNER},{organizationId:mina._id,role:USER_ROLES_IN_ORGANIZATION.MEMBER}]);
    await setMemberships(layla,[{organizationId:mina._id,role:USER_ROLES_IN_ORGANIZATION.OWNER},{organizationId:tripoli._id,role:USER_ROLES_IN_ORGANIZATION.ADMIN}]);
    await setMemberships(rana,[{organizationId:green._id,role:USER_ROLES_IN_ORGANIZATION.OWNER}]);
    await setMemberships(samer,[{organizationId:green._id,role:USER_ROLES_IN_ORGANIZATION.ADMIN}]);
    await setMemberships(nour,[{organizationId:care._id,role:USER_ROLES_IN_ORGANIZATION.OWNER}]);
    await setMemberships(karim,[{organizationId:youth._id,role:USER_ROLES_IN_ORGANIZATION.OWNER},{organizationId:green._id,role:USER_ROLES_IN_ORGANIZATION.MEMBER}]);
    await setMemberships(maya,[{organizationId:equip._id,role:USER_ROLES_IN_ORGANIZATION.OWNER}]);
    await setMemberships(joseph,[{organizationId:equip._id,role:USER_ROLES_IN_ORGANIZATION.ADMIN},{organizationId:logistics._id,role:USER_ROLES_IN_ORGANIZATION.MEMBER}]);
    await setMemberships(dalia,[{organizationId:medical._id,role:USER_ROLES_IN_ORGANIZATION.OWNER}]);

    omar.volunteerProfile = { isActive:true, qualifications:["First aid basics"], serviceAreas:["Tripoli","Mina"], skills:["community outreach","waste sorting","event support"] };
    sara.volunteerProfile = { isActive:true, qualifications:["Nursing student"], serviceAreas:["Tripoli","Mina"], skills:["first aid","registration","public awareness"] };
    tarek.volunteerProfile = { isActive:true, qualifications:["Logistics volunteer"], serviceAreas:["Tripoli"], skills:["logistics","inventory","transport coordination"] };
    await Promise.all([omar.save(), sara.save(), tarek.save()]);

    const resources = await Resource.create([
      {ownerOrganization:equip._id,name:"Heavy Duty Cleanup Bags - Main Stock",description:"Primary industrial cleanup bag stock for environmental campaigns.",category:"cleanup_materials",resourceType:"material",totalQuantity:200,unit:"bags",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:200}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Cleanup Bags - Partial Stock",description:"Smaller cleanup bag inventory designed for partial matching tests.",category:"cleanup_materials",resourceType:"material",totalQuantity:50,unit:"bags",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:50}],status:"available",isActive:true},
      {ownerOrganization:equip._id,name:"Cleanup Bags - Wrong Service Area",description:"Correct category and dates but intentionally outside the target service area.",category:"cleanup_materials",resourceType:"material",totalQuantity:300,unit:"bags",serviceAreas:["Sidon"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:300}],status:"available",isActive:true},
      {ownerOrganization:equip._id,name:"Cleanup Bags - Wrong Dates",description:"Correct category and area but intentionally available after the required period.",category:"cleanup_materials",resourceType:"material",totalQuantity:300,unit:"bags",serviceAreas:["Tripoli"],availabilityWindows:[{startAt:d("2026-10-10T06:00:00Z"),endAt:d("2026-11-10T20:00:00Z"),availableQuantity:300}],status:"available",isActive:true},
      {ownerOrganization:equip._id,name:"Cleanup Bags - Inactive Listing",description:"Matching cleanup inventory intentionally marked inactive for exclusion testing.",category:"cleanup_materials",resourceType:"material",totalQuantity:300,unit:"bags",serviceAreas:["Tripoli"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:300}],status:"inactive",isActive:false},
      {ownerOrganization:equip._id,name:"Industrial Waste Containers",description:"Reusable containers for temporary waste collection and transfer.",category:"cleanup_equipment",resourceType:"equipment",totalQuantity:10,unit:"containers",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:10}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Cargo Transport Vans",description:"Cargo vans for volunteers, equipment, and community material transport.",category:"transportation",resourceType:"vehicle",totalQuantity:3,unit:"vehicles",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-08-10T06:00:00Z"),endAt:d("2026-10-20T20:00:00Z"),availableQuantity:3}],status:"available",isActive:true},
      {ownerOrganization:medical._id,name:"First Aid Safety Kits",description:"First aid kits suitable for field initiatives and community events.",category:"health_and_safety",resourceType:"material",totalQuantity:30,unit:"kits",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-07-01T06:00:00Z"),endAt:d("2026-10-31T20:00:00Z"),availableQuantity:30}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Community Event Hall",description:"Accessible indoor venue for briefings, workshops, and coordination activities.",category:"community_venue",resourceType:"venue",totalQuantity:1,unit:"venues",serviceAreas:["Tripoli"],availabilityWindows:[{startAt:d("2026-08-10T06:00:00Z"),endAt:d("2026-08-31T22:00:00Z"),availableQuantity:1}],status:"available",isActive:true},
      {ownerOrganization:equip._id,name:"Portable Sanitation Units",description:"Portable sanitation equipment currently unavailable because of maintenance.",category:"sanitation_equipment",resourceType:"equipment",totalQuantity:4,unit:"units",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-09-30T20:00:00Z"),availableQuantity:0}],status:"unavailable",isActive:true},
      {ownerOrganization:equip._id,name:"Water Tanker - Original Stock",description:"Original water tanker resource later withdrawn from an accepted contribution.",category:"water_transport",resourceType:"vehicle",totalQuantity:2,unit:"tankers",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T05:00:00Z"),endAt:d("2026-09-15T22:00:00Z"),availableQuantity:2}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Water Tanker - Replacement Stock",description:"Alternative tanker stock suitable for reopened requirement matching tests.",category:"water_transport",resourceType:"vehicle",totalQuantity:3,unit:"tankers",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T05:00:00Z"),endAt:d("2026-09-15T22:00:00Z"),availableQuantity:3}],status:"available",isActive:true},
      {ownerOrganization:medical._id,name:"Mobile Medical Support Teams",description:"Qualified medical teams available for scheduled community health activities.",category:"medical_team",resourceType:"service",totalQuantity:4,unit:"teams",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-07-01T06:00:00Z"),endAt:d("2026-07-31T20:00:00Z"),availableQuantity:4}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Community Micro-Grant Fund",description:"Funding pool reserved for approved civic and community initiatives.",category:"micro_grant",resourceType:"funding",totalQuantity:5000,unit:"USD",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-07-01T00:00:00Z"),endAt:d("2026-07-31T23:59:59Z"),availableQuantity:5000}],status:"available",isActive:true},
      {ownerOrganization:equip._id,name:"Community Gardening Tool Sets",description:"Gardening tool sets for site preparation, planting, and maintenance work.",category:"gardening_equipment",resourceType:"equipment",totalQuantity:20,unit:"sets",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-10-01T06:00:00Z"),endAt:d("2026-11-30T20:00:00Z"),availableQuantity:20}],status:"available",isActive:true},
      {ownerOrganization:medical._id,name:"Community Health Planning Expert",description:"Specialist expertise for planning safe community health and first-aid activities.",category:"health_planning_expertise",resourceType:"expertise",totalQuantity:2,unit:"experts",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T08:00:00Z"),endAt:d("2026-10-31T18:00:00Z"),availableQuantity:2}],status:"available",isActive:true},
      {ownerOrganization:logistics._id,name:"Mobile Power Backup Package",description:"Portable backup power package classified as an other resource for generic-resource API testing.",category:"mobile_power_backup",resourceType:"other",totalQuantity:2,unit:"packages",serviceAreas:["Tripoli","Mina"],availabilityWindows:[{startAt:d("2026-09-01T06:00:00Z"),endAt:d("2026-11-30T20:00:00Z"),availableQuantity:2}],status:"available",isActive:true},
    ]);
    const [bagsMain,bagsPartial,bagsWrongArea,bagsWrongDates,bagsInactive,containers,vans,kits,venue,sanitation,tankerOld,tankerReplacement,medicalTeams,grant,gardenTools,healthExpert,powerBackup] = resources;

    const issueSubmitted = await Issue.create({
      title:"Waste accumulation near public park",
      description:"Large amounts of household waste have accumulated near the public park and surrounding residential streets, creating sanitation and environmental concerns.",
      location:loc("Public Park Area, Tripoli","Al Mina","Tripoli",35.8262,34.4475), municipality:tripoli._id, createdBy:omar._id,
      tags:["waste","environment","cleanup"], status:ISSUE_STATUSES.SUBMITTED, category:"environment", priority:"high",
      aiAnalysis:{ category:"Environmental Waste",priority:"high",suggestedDepartment:"Environmental Services",summary:"The issue likely requires coordinated cleanup resources and volunteer participation.",initiativeRecommendation:{shouldBecomeInitiative:true,reason:"Multiple organizations and resources may be required."},confidenceScore:0.94,modelName:"syntria-ai-seed",analyzedAt:d("2026-08-10T09:00:00Z") },
      duplicateDecision:"no_duplicate", supporting_users:[sara._id,tarek._id], municipalityReview:null,
    });
    const issueDraft = await Issue.create({ title:"Damaged sidewalk near school entrance",description:"Several sidewalk tiles are broken near a school entrance and may create a tripping hazard for children and pedestrians.",location:loc("School Road, Tripoli","Azmi","Tripoli",35.8421,34.4328),municipality:tripoli._id,createdBy:sara._id,tags:["sidewalk","safety"],status:ISSUE_STATUSES.DRAFT,category:"infrastructure",priority:"medium",municipalityReview:null });
    const issueUnderReview = await Issue.create({ title:"Recurring water leak on residential street",description:"Residents report a recurring water leak that is damaging the road surface and creating standing water near nearby homes.",location:loc("Residential Street, Mina","Mina","Mina",35.8184,34.4502),municipality:mina._id,createdBy:tarek._id,tags:["water","infrastructure"],status:ISSUE_STATUSES.UNDER_REVIEW,category:"infrastructure",priority:"high",supporting_users:[omar._id],municipalityReview:null });
    const issueResolved = await Issue.create({ title:"Broken street lighting on residential road",description:"Several street lights are not functioning along a residential road, reducing visibility and creating safety concerns at night.",location:loc("Azmi Street, Tripoli","Azmi","Tripoli",35.8415,34.4332),municipality:tripoli._id,createdBy:tarek._id,tags:["street-light","safety"],status:ISSUE_STATUSES.RESOLVED_INTERNALLY,category:"infrastructure",priority:"medium",duplicateDecision:"no_duplicate",municipalityReview:{decision:MUNICIPALITY_REVIEW_DECISIONS.RESOLVE_INTERNALLY,reviewedBy:layla._id,notes:"Municipal maintenance can resolve this directly without an initiative.",reviewedAt:d("2026-08-08T10:00:00Z")},resolvedInternallyAt:d("2026-08-09T12:00:00Z") });
    const issueConverted = await Issue.create({ title:"Pollution and waste along coastal area",description:"Plastic waste, discarded materials, and debris are accumulating along part of the Tripoli coastline and require a coordinated community cleanup response.",location:loc("Tripoli Coastal Area","Al Mina","Tripoli",35.8098,34.4537),municipality:tripoli._id,createdBy:omar._id,tags:["coast","pollution","cleanup"],status:ISSUE_STATUSES.CONVERTED_TO_INITIATIVE,category:"environment",priority:"high",duplicateDecision:"no_duplicate",supporting_users:[sara._id],municipalityReview:{decision:MUNICIPALITY_REVIEW_DECISIONS.CONVERT_TO_INITIATIVE,reviewedBy:ahmad._id,notes:"The issue needs resources, volunteers, and coordinated execution.",reviewedAt:d("2026-08-07T09:30:00Z")},convertedInitiative:null });
    const issueRejected = await Issue.create({ title:"Request for private building repainting",description:"A request was submitted asking the municipality to repaint the exterior of a privately owned residential building.",location:loc("Private Residential Building","Qobbeh","Tripoli",35.855,34.4452),municipality:tripoli._id,createdBy:sara._id,tags:["private-property","painting"],status:ISSUE_STATUSES.REJECTED,category:"other",priority:"low",duplicateDecision:"no_duplicate",municipalityReview:{decision:MUNICIPALITY_REVIEW_DECISIONS.REJECT,reviewedBy:ahmad._id,notes:"The request concerns private property and is outside the civic coordination scope.",reviewedAt:d("2026-08-05T11:00:00Z")} });
    const issueDuplicate = await Issue.create({ title:"Garbage problem near Mina park",description:"Waste and garbage are continuing to accumulate around the same public park area already reported by another resident.",location:loc("Mina Public Park Area","Al Mina","Tripoli",35.8264,34.4478),municipality:tripoli._id,createdBy:sara._id,tags:["garbage","cleanup"],status:ISSUE_STATUSES.CLOSED,category:"environment",priority:"medium",duplicateCandidates:[{issue:issueSubmitted._id,similarityScore:0.95,reasons:["Same geographic area","Same waste problem"],detectedAt:d("2026-08-11T09:00:00Z")}],duplicateDecision:"supported_existing",supportedExistingIssue:issueSubmitted._id,municipalityReview:null });
    const issues = [issueSubmitted,issueDraft,issueUnderReview,issueResolved,issueConverted,issueRejected,issueDuplicate];

    const ids = {
      a:{p:[oid(),oid(),oid()],t:[oid(),oid(),oid()],r:[oid(),oid(),oid(),oid()]},
      b:{p:[oid(),oid()],t:[oid(),oid(),oid()],r:[oid(),oid(),oid()]},
      c:{p:[oid(),oid()],t:[oid(),oid()],r:[oid(),oid()]},
      d:{p:[oid(),oid()],t:[oid(),oid()],r:[oid()]},
      e:{p:[oid(),oid()],t:[oid(),oid(),oid()],r:[oid(),oid(),oid()]},
      f:{p:[oid()],t:[oid()],r:[oid()]}, g:{p:[oid()],t:[oid(),oid()],r:[oid()]}, h:{p:[oid()],t:[oid()],r:[oid()]},
    };

    const coastal = await Initiative.create({
      title:"Tripoli Coastal Cleanup Campaign", description:"A coordinated environmental initiative led by Green Future NGO to remove waste from the coastline, mobilize volunteers, secure resources, and document environmental impact.",
      location:loc("Tripoli Coastal Area","Al Mina","Tripoli",35.8098,34.4537), municipality:tripoli._id, createdBy:rana._id, tags:["environment","coastal-cleanup","volunteers"], status:INITIATIVE_STATUSES.APPROVED, submittedAt:d("2026-08-06T08:00:00Z"), sourceIssue:issueConverted._id, leadOrganization:green._id,
      expectedOutcome:"Remove accumulated coastal waste, engage residents and volunteers, and document measurable environmental improvements.", executionPeriod:{plannedStartAt:d("2026-09-01T07:00:00Z"),plannedEndAt:d("2026-09-20T17:00:00Z")},
      phases:[phase(ids.a.p[0],"Preparation and Coordination",1,"active","2026-09-01T07:00:00Z","2026-09-05T17:00:00Z"),phase(ids.a.p[1],"Cleanup Execution",2,"pending","2026-09-06T07:00:00Z","2026-09-15T17:00:00Z"),phase(ids.a.p[2],"Impact Review and Reporting",3,"pending","2026-09-16T07:00:00Z","2026-09-20T17:00:00Z")],
      tasks:[
        task({_id:ids.a.t[0],title:"Prepare volunteers and cleanup zones",phaseId:ids.a.p[0],order:1,status:TASK_STATUSES.AVAILABLE,orgId:green._id,skills:["community outreach","event support"],slots:10,progress:25,locked:false}),
        task({_id:ids.a.t[1],title:"Execute coastal cleanup",phaseId:ids.a.p[1],order:1,status:TASK_STATUSES.LOCKED,orgId:green._id,skills:["waste sorting","community outreach"],slots:25,deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.a.t[0],description:"Preparation must finish first."},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.a.r[0],description:"Cleanup bags must be sufficiently reserved."}],lockReasons:["Preparation task incomplete","Cleanup materials not fully reserved"]}),
        task({_id:ids.a.t[2],title:"Document cleanup impact",phaseId:ids.a.p[2],order:1,status:TASK_STATUSES.LOCKED,orgId:green._id,slots:3,deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.a.t[1]}],lockReasons:["Cleanup task incomplete"]}),
      ],
      approval:{decision:"approved",reviewedBy:ahmad._id,notes:"Approved with execution dependent on remaining resource fulfillment.",reviewedAt:d("2026-08-10T09:00:00Z"),revisionNumber:0},
      readiness:{status:READINESS_STATUSES.PARTIALLY_RESOURCED,municipalityApproved:true,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Some requirements remain unmet or partially met."],calculatedAt:d("2026-08-12T12:00:00Z")},
    });

    const inProgress = await Initiative.create({
      title:"Neighborhood Emergency Support Drive",description:"An active support initiative coordinating transport, first-aid supplies, volunteers, and a temporary coordination venue.",location:loc("Central Tripoli Neighborhood","Maarad","Tripoli",35.8445,34.4358),municipality:tripoli._id,createdBy:nour._id,tags:["community-support","logistics","health"],status:INITIATIVE_STATUSES.IN_PROGRESS,submittedAt:d("2026-08-02T09:00:00Z"),leadOrganization:care._id,expectedOutcome:"Coordinate a rapid and safe distribution operation with complete transport, safety, venue, and volunteer support.",executionPeriod:{plannedStartAt:d("2026-08-12T07:00:00Z"),plannedEndAt:d("2026-08-25T18:00:00Z"),actualStartAt:d("2026-08-12T07:20:00Z")},
      phases:[phase(ids.b.p[0],"Mobilization",1,"completed","2026-08-12T07:00:00Z","2026-08-14T18:00:00Z"),phase(ids.b.p[1],"Distribution and Follow-up",2,"active","2026-08-15T07:00:00Z","2026-08-25T18:00:00Z")],
      tasks:[task({_id:ids.b.t[0],title:"Confirm distribution route",phaseId:ids.b.p[0],order:1,status:TASK_STATUSES.COMPLETED,orgId:care._id,skills:["logistics"],slots:2,progress:100,locked:false,completedBy:nour._id,actualStartAt:"2026-08-12T07:20:00Z",completedAt:"2026-08-12T11:30:00Z"}),task({_id:ids.b.t[1],title:"Operate community distribution point",phaseId:ids.b.p[1],order:1,status:TASK_STATUSES.IN_PROGRESS,orgId:care._id,skills:["event support","first aid"],slots:8,progress:45,locked:false,actualStartAt:"2026-08-15T07:10:00Z",deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.b.t[0]},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.b.r[0]},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.b.r[2]}]}),task({_id:ids.b.t[2],title:"Complete distribution audit",phaseId:ids.b.p[1],order:2,status:TASK_STATUSES.LOCKED,orgId:care._id,skills:["inventory"],slots:2,deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.b.t[1]}],lockReasons:["Distribution is still active"]})],
      approval:{decision:"approved",reviewedBy:layla._id,notes:"Approved for immediate execution.",reviewedAt:d("2026-08-05T10:00:00Z"),revisionNumber:0},readiness:{status:READINESS_STATUSES.READY_TO_EXECUTE,municipalityApproved:true,resourcesSatisfied:true,dependenciesSatisfied:true,blockingReasons:[],calculatedAt:d("2026-08-12T06:00:00Z")},
    });

    const changesRequested = await Initiative.create({ title:"Neighborhood Park Rehabilitation",description:"A proposed rehabilitation of a neglected neighborhood park including landscaping and funding support.",location:loc("Neighborhood Park, Mina","Mina","Mina",35.8175,34.452),municipality:mina._id,createdBy:karim._id,tags:["park","environment","youth"],status:INITIATIVE_STATUSES.CHANGES_REQUESTED,submittedAt:d("2026-08-06T12:00:00Z"),leadOrganization:youth._id,expectedOutcome:"Restore the park for safe neighborhood use and establish a volunteer-supported maintenance plan.",executionPeriod:{plannedStartAt:d("2026-10-05T08:00:00Z"),plannedEndAt:d("2026-11-10T17:00:00Z")},phases:[phase(ids.c.p[0],"Site Preparation",1,"locked"),phase(ids.c.p[1],"Rehabilitation",2,"locked")],tasks:[task({_id:ids.c.t[0],title:"Prepare rehabilitation plan",phaseId:ids.c.p[0],order:1,status:TASK_STATUSES.LOCKED,orgId:youth._id,lockReasons:["Municipality requested changes"]}),task({_id:ids.c.t[1],title:"Execute park rehabilitation",phaseId:ids.c.p[1],order:1,status:TASK_STATUSES.LOCKED,orgId:youth._id,slots:10,deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.c.t[0]},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.c.r[0]}],lockReasons:["Municipality requested changes"]})],approval:{decision:"changes_requested",reviewedBy:layla._id,notes:"Clarify tool quantities, funding need, maintenance responsibilities, and final timeline.",reviewedAt:d("2026-08-09T14:00:00Z"),revisionNumber:1},readiness:{status:READINESS_STATUSES.BLOCKED,municipalityApproved:false,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Municipality requested changes","Requirements are not verified"],calculatedAt:d("2026-08-09T14:05:00Z")} });

    const withdrawal = await Initiative.create({ title:"Emergency Water Distribution Support",description:"A municipality-approved water initiative with a reopened tanker requirement after the original resource partner withdrew.",location:loc("Water Distribution Zone","Qobbeh","Tripoli",35.8561,34.446),municipality:tripoli._id,createdBy:rana._id,tags:["water","emergency","resource-replacement"],status:INITIATIVE_STATUSES.APPROVED,submittedAt:d("2026-08-03T09:00:00Z"),leadOrganization:green._id,expectedOutcome:"Restore withdrawn tanker capacity and provide reliable water distribution during the planned support period.",executionPeriod:{plannedStartAt:d("2026-09-03T06:00:00Z"),plannedEndAt:d("2026-09-12T20:00:00Z")},phases:[phase(ids.d.p[0],"Resource Mobilization",1,"active"),phase(ids.d.p[1],"Water Distribution",2,"locked")],tasks:[task({_id:ids.d.t[0],title:"Secure replacement tanker capacity",phaseId:ids.d.p[0],order:1,status:TASK_STATUSES.AVAILABLE,orgId:green._id,progress:20,locked:false}),task({_id:ids.d.t[1],title:"Dispatch water tankers",phaseId:ids.d.p[1],order:1,status:TASK_STATUSES.LOCKED,orgId:green._id,skills:["logistics"],slots:3,deps:[{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.d.r[0]}],lockReasons:["Tanker requirement reopened after withdrawal"]})],approval:{decision:"approved",reviewedBy:ahmad._id,notes:"Approved before the original partner withdrawal.",reviewedAt:d("2026-08-05T09:00:00Z"),revisionNumber:0},readiness:{status:READINESS_STATUSES.BLOCKED,municipalityApproved:true,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Water tanker reservation was withdrawn","Requirement reopened"],calculatedAt:d("2026-08-12T08:40:00Z")} });

    const published = await Initiative.create({ title:"Tripoli Community Health Day",description:"A completed and published health initiative that provided screening, first-aid support, and public-health outreach.",location:loc("Community Health Center","Maarad","Tripoli",35.8432,34.4346),municipality:tripoli._id,createdBy:nour._id,tags:["health","community","published"],status:INITIATIVE_STATUSES.PUBLISHED,submittedAt:d("2026-06-20T08:00:00Z"),leadOrganization:care._id,expectedOutcome:"Deliver accessible screening and first-aid support while documenting participation and service impact.",executionPeriod:{plannedStartAt:d("2026-07-10T08:00:00Z"),plannedEndAt:d("2026-07-15T18:00:00Z"),actualStartAt:d("2026-07-10T08:10:00Z"),actualEndAt:d("2026-07-15T16:45:00Z")},phases:[phase(ids.e.p[0],"Health Event Delivery",1,"completed"),phase(ids.e.p[1],"Inspection and Publication",2,"completed")],tasks:[task({_id:ids.e.t[0],title:"Register community participants",phaseId:ids.e.p[0],order:1,status:TASK_STATUSES.COMPLETED,orgId:care._id,skills:["registration"],slots:5,completedBy:nour._id,progress:100,locked:false,actualStartAt:"2026-07-10T08:10:00Z",completedAt:"2026-07-14T17:30:00Z"}),task({_id:ids.e.t[1],title:"Deliver medical support",phaseId:ids.e.p[0],order:2,status:TASK_STATUSES.COMPLETED,orgId:care._id,skills:["first aid"],slots:6,completedBy:nour._id,progress:100,locked:false,deps:[{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.e.r[0]},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.e.r[1]}],actualStartAt:"2026-07-10T09:00:00Z",completedAt:"2026-07-14T18:00:00Z"}),task({_id:ids.e.t[2],title:"Finalize impact report",phaseId:ids.e.p[1],order:1,status:TASK_STATUSES.COMPLETED,orgId:care._id,completedBy:nour._id,progress:100,locked:false,deps:[{type:DEPENDENCY_TYPES.TASK,taskId:ids.e.t[1]}],actualStartAt:"2026-07-15T08:00:00Z",completedAt:"2026-07-15T15:00:00Z"})],approval:{decision:"approved",reviewedBy:ahmad._id,notes:"Approved for community health execution.",reviewedAt:d("2026-06-25T09:00:00Z"),revisionNumber:0},readiness:{status:READINESS_STATUSES.READY_TO_EXECUTE,municipalityApproved:true,resourcesSatisfied:true,dependenciesSatisfied:true,blockingReasons:[],calculatedAt:d("2026-07-09T12:00:00Z")},completionRequest:{requestedBy:nour._id,notes:"All tasks completed and evidence submitted for review.",requestedAt:d("2026-07-15T15:10:00Z")},inspections:[{inspectedBy:ahmad._id,decision:"passed",notes:"Outputs, attendance, resource delivery, and evidence were verified.",evidenceMediaIds:[],inspectedAt:d("2026-07-16T10:00:00Z")}],impactMetrics:[{metricName:"Residents screened",value:185,unit:"people",verified:true},{metricName:"Volunteer hours",value:96,unit:"hours",verified:true}],publishedAt:d("2026-07-18T09:00:00Z") });

    const draft = await Initiative.create({ title:"Community Garden Development",description:"A draft initiative for creating a volunteer-managed shared garden and green space in Tripoli.",location:loc("Community Center Area","Tripoli","Tripoli",35.838,34.435),municipality:tripoli._id,createdBy:karim._id,tags:["garden","community","draft"],status:INITIATIVE_STATUSES.DRAFT,leadOrganization:youth._id,expectedOutcome:"Create a community-managed green space that supports neighborhood engagement.",executionPeriod:{plannedStartAt:d("2026-10-01T08:00:00Z"),plannedEndAt:d("2026-11-15T17:00:00Z")},phases:[phase(ids.f.p[0],"Garden Preparation",1,"pending")],tasks:[task({_id:ids.f.t[0],title:"Prepare garden site",phaseId:ids.f.p[0],order:1,status:TASK_STATUSES.LOCKED,orgId:youth._id,skills:["community outreach"],slots:5,lockReasons:["Initiative is still a draft"]})],approval:{decision:"pending",revisionNumber:0},readiness:{status:READINESS_STATUSES.BLOCKED,municipalityApproved:false,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Initiative has not been submitted"],calculatedAt:d("2026-08-12T09:00:00Z")} });

    const submitted = await Initiative.create({ title:"School Entrance Accessibility Upgrade",description:"A submitted initiative proposing safer and more accessible entry arrangements at a public school.",location:loc("Public School Entrance","Mina","Mina",35.8201,34.4484),municipality:mina._id,createdBy:karim._id,tags:["school","accessibility","submitted"],status:INITIATIVE_STATUSES.SUBMITTED,submittedAt:d("2026-08-12T10:00:00Z"),leadOrganization:youth._id,expectedOutcome:"Improve safe access at the school entrance and coordinate required transportation support.",executionPeriod:{plannedStartAt:d("2026-10-10T08:00:00Z"),plannedEndAt:d("2026-10-20T17:00:00Z")},phases:[phase(ids.g.p[0],"Approval and Preparation",1,"locked")],tasks:[task({_id:ids.g.t[0],title:"Wait for municipality approval",phaseId:ids.g.p[0],order:1,status:TASK_STATUSES.LOCKED,orgId:youth._id,deps:[{type:DEPENDENCY_TYPES.APPROVAL,approvalType:"municipality_approval",description:"Municipality approval required."}],lockReasons:["Municipality review pending"]}),task({_id:ids.g.t[1],title:"Coordinate accessibility transport",phaseId:ids.g.p[0],order:2,status:TASK_STATUSES.LOCKED,orgId:youth._id,deps:[{type:DEPENDENCY_TYPES.APPROVAL,approvalType:"municipality_approval"},{type:DEPENDENCY_TYPES.RESOURCE,resourceRequirement:ids.g.r[0]}],lockReasons:["Municipality review pending","Resource requirement unverified"]})],approval:{decision:"pending",revisionNumber:0},readiness:{status:READINESS_STATUSES.BLOCKED,municipalityApproved:false,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Municipality approval pending","Requirement unverified"],calculatedAt:d("2026-08-12T10:05:00Z")} });

    const rejected = await Initiative.create({ title:"Temporary Winter Shelter Proposal",description:"A proposed temporary shelter initiative rejected because the submitted site and operating plan did not satisfy municipal requirements.",location:loc("Proposed Shelter Site","Mina","Mina",35.8154,34.4541),municipality:mina._id,createdBy:karim._id,tags:["shelter","rejected"],status:INITIATIVE_STATUSES.REJECTED,submittedAt:d("2026-08-01T08:00:00Z"),leadOrganization:youth._id,expectedOutcome:"Provide temporary winter shelter capacity if a compliant site and operating plan can be secured.",executionPeriod:{plannedStartAt:d("2026-11-15T08:00:00Z"),plannedEndAt:d("2027-02-15T17:00:00Z")},phases:[phase(ids.h.p[0],"Shelter Preparation",1,"cancelled")],tasks:[task({_id:ids.h.t[0],title:"Prepare temporary shelter venue",phaseId:ids.h.p[0],order:1,status:TASK_STATUSES.CANCELLED,orgId:youth._id,lockReasons:["Initiative rejected"]})],approval:{decision:"rejected",reviewedBy:layla._id,notes:"Site plan lacks required safety, accessibility, and operating details.",reviewedAt:d("2026-08-04T13:00:00Z"),revisionNumber:0},readiness:{status:READINESS_STATUSES.BLOCKED,municipalityApproved:false,resourcesSatisfied:false,dependenciesSatisfied:false,blockingReasons:["Initiative rejected"],calculatedAt:d("2026-08-04T13:05:00Z")} });

    const initiatives = [coastal,inProgress,changesRequested,withdrawal,published,draft,submitted,rejected];
    issueConverted.convertedInitiative = coastal._id;
    await issueConverted.save();

    const requirements = await ResourceRequirement.create([
      req({_id:ids.a.r[0],initiative:coastal._id,category:"cleanup_materials",name:"Heavy Duty Cleanup Bags",quantity:150,unit:"bags",cost:300,from:"2026-09-05T07:00:00Z",until:"2026-09-15T18:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.a.r[1],initiative:coastal._id,category:"cleanup_equipment",name:"Waste Containers",quantity:8,unit:"containers",cost:800,from:"2026-09-05T07:00:00Z",until:"2026-09-15T18:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.a.r[2],initiative:coastal._id,category:"health_and_safety",name:"First Aid Safety Kits",quantity:10,unit:"kits",cost:260,from:"2026-09-05T07:00:00Z",until:"2026-09-15T18:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.a.r[3],initiative:coastal._id,category:"transportation",name:"Cleanup Transport Vehicle",quantity:1,unit:"vehicles",cost:150,from:"2026-09-05T07:00:00Z",until:"2026-09-15T18:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.b.r[0],initiative:inProgress._id,category:"transportation",name:"Distribution Transport Vans",quantity:2,unit:"vehicles",cost:400,from:"2026-08-15T06:00:00Z",until:"2026-08-22T20:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.b.r[1],initiative:inProgress._id,category:"health_and_safety",name:"Distribution First Aid Kits",quantity:5,unit:"kits",cost:125,from:"2026-08-15T06:00:00Z",until:"2026-08-22T20:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.b.r[2],initiative:inProgress._id,category:"community_venue",name:"Temporary Coordination Venue",quantity:1,unit:"venues",cost:300,from:"2026-08-15T06:00:00Z",until:"2026-08-22T20:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.c.r[0],initiative:changesRequested._id,category:"gardening_equipment",name:"Gardening Tool Sets",quantity:10,unit:"sets",cost:350,from:"2026-10-05T07:00:00Z",until:"2026-11-10T18:00:00Z",area:"Mina",verified:false}),
      req({_id:ids.c.r[1],initiative:changesRequested._id,category:"micro_grant",name:"Park Rehabilitation Funding",quantity:2000,unit:"USD",cost:2000,from:"2026-10-01T00:00:00Z",until:"2026-11-10T23:59:59Z",area:"Mina",verified:false}),
      req({_id:ids.d.r[0],initiative:withdrawal._id,category:"water_transport",name:"Emergency Water Tankers",quantity:2,unit:"tankers",cost:600,from:"2026-09-03T05:00:00Z",until:"2026-09-12T21:00:00Z",area:"Tripoli",verified:true,reopenedAt:"2026-08-12T08:35:00Z"}),
      req({_id:ids.e.r[0],initiative:published._id,category:"health_and_safety",name:"Health Day First Aid Kits",quantity:20,unit:"kits",cost:500,from:"2026-07-10T07:00:00Z",until:"2026-07-14T19:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.e.r[1],initiative:published._id,category:"medical_team",name:"Medical Support Teams",quantity:2,unit:"teams",cost:300,from:"2026-07-10T07:00:00Z",until:"2026-07-14T19:00:00Z",area:"Tripoli",verified:true}),
      req({_id:ids.e.r[2],initiative:published._id,category:"micro_grant",name:"Health Day Micro-Grant",quantity:5000,unit:"USD",cost:5000,from:"2026-07-01T00:00:00Z",until:"2026-07-15T23:59:59Z",area:"Tripoli",verified:true}),
      req({_id:ids.f.r[0],initiative:draft._id,category:"gardening_equipment",name:"Community Gardening Tool Sets",quantity:10,unit:"sets",cost:300,from:"2026-10-01T07:00:00Z",until:"2026-11-15T18:00:00Z",area:"Tripoli",verified:false}),
      req({_id:ids.g.r[0],initiative:submitted._id,category:"transportation",name:"Accessibility Support Vehicle",quantity:1,unit:"vehicles",cost:150,from:"2026-10-10T07:00:00Z",until:"2026-10-20T18:00:00Z",area:"Mina",verified:false}),
      req({_id:ids.h.r[0],initiative:rejected._id,category:"community_venue",name:"Temporary Shelter Venue",quantity:1,unit:"venues",cost:1000,from:"2026-11-15T07:00:00Z",until:"2027-02-15T18:00:00Z",area:"Mina",verified:false}),
    ]);

    const requests = await ResourceRequest.create([
      {initiative:coastal._id,resourceRequirement:ids.a.r[1],resource:containers._id,partnerOrganization:equip._id,requestedBy:rana._id,quantityRequested:8,unit:"containers",requestedFrom:d("2026-09-05T07:00:00Z"),requestedUntil:d("2026-09-15T18:00:00Z"),requestNotes:"Requesting full container requirement.",status:RESOURCE_REQUEST_STATUSES.ACCEPTED,review:{reviewedBy:maya._id,notes:"Eight containers confirmed.",reviewedAt:d("2026-08-11T08:00:00Z")}},
      {initiative:coastal._id,resourceRequirement:ids.a.r[2],resource:kits._id,partnerOrganization:medical._id,requestedBy:rana._id,quantityRequested:10,unit:"kits",requestedFrom:d("2026-09-05T07:00:00Z"),requestedUntil:d("2026-09-15T18:00:00Z"),requestNotes:"Pending safety-kit request.",status:RESOURCE_REQUEST_STATUSES.PENDING},
      {initiative:coastal._id,resourceRequirement:ids.a.r[0],resource:bagsWrongDates._id,partnerOrganization:equip._id,requestedBy:rana._id,quantityRequested:50,unit:"bags",requestedFrom:d("2026-09-05T07:00:00Z"),requestedUntil:d("2026-09-15T18:00:00Z"),requestNotes:"Rejected because availability does not cover required dates.",status:RESOURCE_REQUEST_STATUSES.REJECTED,review:{reviewedBy:maya._id,notes:"Stock is available only after the required period.",reviewedAt:d("2026-08-10T13:00:00Z")}},
      {initiative:coastal._id,resourceRequirement:ids.a.r[3],resource:vans._id,partnerOrganization:logistics._id,requestedBy:rana._id,quantityRequested:1,unit:"vehicles",requestedFrom:d("2026-09-05T07:00:00Z"),requestedUntil:d("2026-09-15T18:00:00Z"),requestNotes:"Withdrawn after logistics plan changed.",status:RESOURCE_REQUEST_STATUSES.WITHDRAWN,withdrawnAt:d("2026-08-11T15:00:00Z"),withdrawalReason:"Lead organization will reassess transport after route planning."},
      {initiative:inProgress._id,resourceRequirement:ids.b.r[0],resource:vans._id,partnerOrganization:logistics._id,requestedBy:nour._id,quantityRequested:2,unit:"vehicles",requestedFrom:d("2026-08-15T06:00:00Z"),requestedUntil:d("2026-08-22T20:00:00Z"),requestNotes:"Active request for two vans.",status:RESOURCE_REQUEST_STATUSES.ACCEPTED,review:{reviewedBy:joseph._id,notes:"Two vans allocated.",reviewedAt:d("2026-08-10T09:00:00Z")}},
      {initiative:withdrawal._id,resourceRequirement:ids.d.r[0],resource:tankerReplacement._id,partnerOrganization:logistics._id,requestedBy:rana._id,quantityRequested:2,unit:"tankers",requestedFrom:d("2026-09-03T05:00:00Z"),requestedUntil:d("2026-09-12T21:00:00Z"),requestNotes:"Replacement request after original partner withdrawal.",status:RESOURCE_REQUEST_STATUSES.PENDING},
      {initiative:published._id,resourceRequirement:ids.e.r[0],resource:kits._id,partnerOrganization:medical._id,requestedBy:nour._id,quantityRequested:20,unit:"kits",requestedFrom:d("2026-07-10T07:00:00Z"),requestedUntil:d("2026-07-14T19:00:00Z"),requestNotes:"Completed first-aid kit request.",status:RESOURCE_REQUEST_STATUSES.FULFILLED,review:{reviewedBy:dalia._id,notes:"Kits delivered and request fulfilled.",reviewedAt:d("2026-07-09T09:00:00Z")}},
    ]);
    const [reqContainers,reqPendingKits,reqRejectedDates,reqWithdrawnTransport,reqVans,reqReplacement,reqHealthKits] = requests;

    const offerAcceptedBags = await ContributionOffer.create({initiative:coastal._id,partnerOrganization:equip._id,submittedBy:maya._id,items:[{resourceRequirement:ids.a.r[0],resource:bagsMain._id,quantityOffered:70,unit:"bags",unitPrice:0,additionalCost:0,currency:"USD",isDonation:true,availableFrom:d("2026-09-05T07:00:00Z"),availableUntil:d("2026-09-15T18:00:00Z"),deliveryConditions:"Lead organization collects donated stock from the warehouse."}],status:OFFER_STATUSES.ACCEPTED,organizationNotes:"Donation covering part of the cleanup-bag requirement.",review:{reviewedBy:rana._id,notes:"Accepted as partial fulfillment.",reviewedAt:d("2026-08-11T09:00:00Z")}});
    const offerSubmittedKits = await ContributionOffer.create({initiative:coastal._id,partnerOrganization:medical._id,submittedBy:dalia._id,items:[{resourceRequirement:ids.a.r[2],resource:kits._id,quantityOffered:10,unit:"kits",unitPrice:25,additionalCost:10,currency:"USD",isDonation:false,availableFrom:d("2026-09-05T07:00:00Z"),availableUntil:d("2026-09-15T18:00:00Z"),deliveryConditions:"Delivery to the lead organization office is included."}],status:OFFER_STATUSES.SUBMITTED,organizationNotes:"Paid offer for the complete safety-kit requirement."});
    const offerUnderReviewContainers = await ContributionOffer.create({initiative:coastal._id,partnerOrganization:equip._id,submittedBy:maya._id,items:[{resourceRequirement:ids.a.r[1],resource:containers._id,quantityOffered:4,unit:"containers",unitPrice:40,additionalCost:20,currency:"USD",isDonation:false,availableFrom:d("2026-09-05T07:00:00Z"),availableUntil:d("2026-09-15T18:00:00Z"),deliveryConditions:"Partner delivers and retrieves the containers."}],status:OFFER_STATUSES.UNDER_REVIEW,organizationNotes:"Alternative offer retained for review testing."});
    const offerRejectedArea = await ContributionOffer.create({initiative:coastal._id,partnerOrganization:equip._id,submittedBy:maya._id,items:[{resourceRequirement:ids.a.r[0],resource:bagsWrongArea._id,quantityOffered:50,unit:"bags",unitPrice:0,additionalCost:0,currency:"USD",isDonation:true,availableFrom:d("2026-09-05T07:00:00Z"),availableUntil:d("2026-09-15T18:00:00Z"),deliveryConditions:"Stock is outside the target service area."}],status:OFFER_STATUSES.REJECTED,organizationNotes:"Rejected for service-area coverage testing.",review:{reviewedBy:rana._id,notes:"Resource service area does not match requirement.",reviewedAt:d("2026-08-11T10:30:00Z")}});
    const offerAcceptedKits = await ContributionOffer.create({initiative:inProgress._id,partnerOrganization:medical._id,submittedBy:dalia._id,items:[{resourceRequirement:ids.b.r[1],resource:kits._id,quantityOffered:5,unit:"kits",unitPrice:0,additionalCost:0,currency:"USD",isDonation:true,availableFrom:d("2026-08-15T06:00:00Z"),availableUntil:d("2026-08-22T20:00:00Z"),deliveryConditions:"Donated kits delivered before opening."}],status:OFFER_STATUSES.ACCEPTED,review:{reviewedBy:nour._id,notes:"Accepted donation.",reviewedAt:d("2026-08-10T10:00:00Z")}});
    const offerAcceptedVenue = await ContributionOffer.create({initiative:inProgress._id,partnerOrganization:logistics._id,submittedBy:joseph._id,items:[{resourceRequirement:ids.b.r[2],resource:venue._id,quantityOffered:1,unit:"venues",unitPrice:250,additionalCost:50,currency:"USD",isDonation:false,availableFrom:d("2026-08-15T06:00:00Z"),availableUntil:d("2026-08-22T20:00:00Z"),deliveryConditions:"Venue fee includes setup and utilities."}],status:OFFER_STATUSES.ACCEPTED,review:{reviewedBy:nour._id,notes:"Accepted coordination venue.",reviewedAt:d("2026-08-10T10:30:00Z")}});
    const offerWithdrawnWater = await ContributionOffer.create({initiative:withdrawal._id,partnerOrganization:equip._id,submittedBy:maya._id,items:[{resourceRequirement:ids.d.r[0],resource:tankerOld._id,quantityOffered:2,unit:"tankers",unitPrice:0,additionalCost:0,currency:"USD",isDonation:true,availableFrom:d("2026-09-03T05:00:00Z"),availableUntil:d("2026-09-12T21:00:00Z"),deliveryConditions:"Initially accepted donated tanker capacity."}],status:OFFER_STATUSES.WITHDRAWN,organizationNotes:"Initially accepted, later withdrawn because of emergency fleet reassignment.",review:{reviewedBy:rana._id,notes:"Previously accepted before partner withdrawal.",reviewedAt:d("2026-08-08T09:00:00Z")},withdrawnAt:d("2026-08-12T08:30:00Z"),withdrawalReason:"Partner fleet reassigned to an emergency."});
    const offerCompletedMedical = await ContributionOffer.create({initiative:published._id,partnerOrganization:medical._id,submittedBy:dalia._id,items:[{resourceRequirement:ids.e.r[1],resource:medicalTeams._id,quantityOffered:2,unit:"teams",unitPrice:150,additionalCost:0,currency:"USD",isDonation:false,availableFrom:d("2026-07-10T07:00:00Z"),availableUntil:d("2026-07-14T19:00:00Z"),deliveryConditions:"Teams operated on site during scheduled hours."}],status:OFFER_STATUSES.COMPLETED,organizationNotes:"Medical support completed successfully.",review:{reviewedBy:nour._id,notes:"Accepted and completed.",reviewedAt:d("2026-07-08T10:00:00Z")}});
    const offerCompletedGrant = await ContributionOffer.create({initiative:published._id,partnerOrganization:logistics._id,submittedBy:joseph._id,items:[{resourceRequirement:ids.e.r[2],resource:grant._id,quantityOffered:5000,unit:"USD",unitPrice:0,additionalCost:0,currency:"USD",isDonation:true,availableFrom:d("2026-07-01T00:00:00Z"),availableUntil:d("2026-07-15T23:59:59Z"),deliveryConditions:"Grant transferred for approved event operating costs."}],status:OFFER_STATUSES.COMPLETED,organizationNotes:"Donated micro-grant fully used by the completed initiative.",review:{reviewedBy:nour._id,notes:"Funding approved and completed.",reviewedAt:d("2026-07-02T10:00:00Z")}});
    const offers = [offerAcceptedBags,offerSubmittedKits,offerUnderReviewContainers,offerRejectedArea,offerAcceptedKits,offerAcceptedVenue,offerWithdrawnWater,offerCompletedMedical,offerCompletedGrant];

    const reservations = await ResourceReservation.create([
      {initiative:coastal._id,resourceRequirement:ids.a.r[0],resource:bagsMain._id,resourceRequest:null,contributionOffer:offerAcceptedBags._id,contributionOfferItemId:offerAcceptedBags.items[0]._id,quantity:70,unit:"bags",reservedFrom:d("2026-09-05T07:00:00Z"),reservedUntil:d("2026-09-15T18:00:00Z"),agreedUnitPrice:0,agreedAdditionalCost:0,agreedTotalCost:0,currency:"USD",status:"active",reservedBy:rana._id},
      {initiative:coastal._id,resourceRequirement:ids.a.r[1],resource:containers._id,resourceRequest:reqContainers._id,contributionOffer:null,contributionOfferItemId:null,quantity:8,unit:"containers",reservedFrom:d("2026-09-05T07:00:00Z"),reservedUntil:d("2026-09-15T18:00:00Z"),status:"active",reservedBy:rana._id},
      {initiative:inProgress._id,resourceRequirement:ids.b.r[0],resource:vans._id,resourceRequest:reqVans._id,contributionOffer:null,contributionOfferItemId:null,quantity:2,unit:"vehicles",reservedFrom:d("2026-08-15T06:00:00Z"),reservedUntil:d("2026-08-22T20:00:00Z"),status:"active",reservedBy:nour._id},
      {initiative:inProgress._id,resourceRequirement:ids.b.r[1],resource:kits._id,resourceRequest:null,contributionOffer:offerAcceptedKits._id,contributionOfferItemId:offerAcceptedKits.items[0]._id,quantity:5,unit:"kits",reservedFrom:d("2026-08-15T06:00:00Z"),reservedUntil:d("2026-08-22T20:00:00Z"),agreedUnitPrice:0,agreedAdditionalCost:0,agreedTotalCost:0,currency:"USD",status:"active",reservedBy:nour._id},
      {initiative:inProgress._id,resourceRequirement:ids.b.r[2],resource:venue._id,resourceRequest:null,contributionOffer:offerAcceptedVenue._id,contributionOfferItemId:offerAcceptedVenue.items[0]._id,quantity:1,unit:"venues",reservedFrom:d("2026-08-15T06:00:00Z"),reservedUntil:d("2026-08-22T20:00:00Z"),agreedUnitPrice:250,agreedAdditionalCost:50,agreedTotalCost:300,currency:"USD",status:"active",reservedBy:nour._id},
      {initiative:withdrawal._id,resourceRequirement:ids.d.r[0],resource:tankerOld._id,resourceRequest:null,contributionOffer:offerWithdrawnWater._id,contributionOfferItemId:offerWithdrawnWater.items[0]._id,quantity:2,unit:"tankers",reservedFrom:d("2026-09-03T05:00:00Z"),reservedUntil:d("2026-09-12T21:00:00Z"),agreedUnitPrice:0,agreedAdditionalCost:0,agreedTotalCost:0,currency:"USD",status:"withdrawn",reservedBy:rana._id,releasedAt:d("2026-08-12T08:32:00Z"),releaseReason:"Partner withdrew the accepted tanker contribution."},
      {initiative:published._id,resourceRequirement:ids.e.r[0],resource:kits._id,resourceRequest:reqHealthKits._id,contributionOffer:null,contributionOfferItemId:null,quantity:20,unit:"kits",reservedFrom:d("2026-07-10T07:00:00Z"),reservedUntil:d("2026-07-14T19:00:00Z"),status:"fulfilled",reservedBy:nour._id},
      {initiative:published._id,resourceRequirement:ids.e.r[1],resource:medicalTeams._id,resourceRequest:null,contributionOffer:offerCompletedMedical._id,contributionOfferItemId:offerCompletedMedical.items[0]._id,quantity:2,unit:"teams",reservedFrom:d("2026-07-10T07:00:00Z"),reservedUntil:d("2026-07-14T19:00:00Z"),agreedUnitPrice:150,agreedAdditionalCost:0,agreedTotalCost:300,currency:"USD",status:"fulfilled",reservedBy:nour._id},
      {initiative:published._id,resourceRequirement:ids.e.r[2],resource:grant._id,resourceRequest:null,contributionOffer:offerCompletedGrant._id,contributionOfferItemId:offerCompletedGrant.items[0]._id,quantity:5000,unit:"USD",reservedFrom:d("2026-07-01T00:00:00Z"),reservedUntil:d("2026-07-15T23:59:59Z"),agreedUnitPrice:0,agreedAdditionalCost:0,agreedTotalCost:0,currency:"USD",status:"fulfilled",reservedBy:nour._id},
    ]);
    const [resBags,resContainers,resVans,resKits,resVenue,resWithdrawn,resHealthKits,resMedical,resGrant] = reservations;

    await syncRequirementCaches(new Set([s(ids.e.r[0]),s(ids.e.r[1]),s(ids.e.r[2])]));
    await Resource.findByIdAndUpdate(bagsMain._id,{status:"partially_reserved"},{runValidators:true});
    await Resource.findByIdAndUpdate(containers._id,{status:"partially_reserved"},{runValidators:true});
    await Resource.findByIdAndUpdate(vans._id,{status:"partially_reserved"},{runValidators:true});
    await Resource.findByIdAndUpdate(kits._id,{status:"partially_reserved"},{runValidators:true});
    await Resource.findByIdAndUpdate(venue._id,{status:"fully_reserved"},{runValidators:true});
    await Resource.findByIdAndUpdate(grant._id,{status:"fully_reserved"},{runValidators:true});

    coastal.availableResources = [{resource:bagsMain._id,quantity:70,notes:"Active donation reservation."},{resource:containers._id,quantity:8,notes:"Active request-based reservation."}];
    inProgress.availableResources = [{resource:vans._id,quantity:2,notes:"Active transport reservation."},{resource:kits._id,quantity:5,notes:"Accepted donation reservation."},{resource:venue._id,quantity:1,notes:"Fully reserved coordination venue."}];
    published.availableResources = [{resource:kits._id,quantity:20,notes:"Fulfilled first-aid allocation."},{resource:medicalTeams._id,quantity:2,notes:"Fulfilled medical support allocation."},{resource:grant._id,quantity:5000,notes:"Fulfilled grant allocation."}];
    await Promise.all([coastal.save(),inProgress.save(),published.save()]);

    const applications = await VolunteerApplication.create([
      {initiative:coastal._id,taskId:ids.a.t[0],volunteer:omar._id,status:APPLICATION_STATUSES.ACCEPTED,applicationMessage:"I can help coordinate volunteer zones and safety briefings.",eligibilitySnapshot:{matchedSkills:["community outreach","event support"],missingSkills:[],serviceAreaMatched:true,taskUnlockedAtApplication:true},reviewedBy:rana._id,reviewedAt:d("2026-08-11T12:00:00Z"),reviewNotes:"Accepted for preparation support."},
      {initiative:coastal._id,taskId:ids.a.t[0],volunteer:sara._id,status:APPLICATION_STATUSES.PENDING,applicationMessage:"Available to support registration and first-aid coordination.",eligibilitySnapshot:{matchedSkills:["registration"],missingSkills:["event support"],serviceAreaMatched:true,taskUnlockedAtApplication:true}},
      {initiative:coastal._id,taskId:ids.a.t[1],volunteer:tarek._id,status:APPLICATION_STATUSES.REJECTED,applicationMessage:"I can support cleanup logistics.",eligibilitySnapshot:{matchedSkills:[],missingSkills:["waste sorting","community outreach"],serviceAreaMatched:true,taskUnlockedAtApplication:false},reviewedBy:rana._id,reviewedAt:d("2026-08-11T13:00:00Z"),reviewNotes:"Task is locked and skills do not match the current role."},
      {initiative:inProgress._id,taskId:ids.b.t[1],volunteer:omar._id,status:APPLICATION_STATUSES.COMPLETED,applicationMessage:"Available for distribution-point support.",eligibilitySnapshot:{matchedSkills:["event support"],missingSkills:[],serviceAreaMatched:true,taskUnlockedAtApplication:true},reviewedBy:nour._id,reviewedAt:d("2026-08-12T14:00:00Z"),reviewNotes:"Accepted for first distribution shift.",checkInAt:d("2026-08-15T07:05:00Z"),checkOutAt:d("2026-08-15T14:10:00Z"),completionEvidenceMediaIds:[]},
      {initiative:inProgress._id,taskId:ids.b.t[1],volunteer:sara._id,status:APPLICATION_STATUSES.ACCEPTED,applicationMessage:"I can support first-aid and participant flow.",eligibilitySnapshot:{matchedSkills:["first aid"],missingSkills:[],serviceAreaMatched:true,taskUnlockedAtApplication:true},reviewedBy:nour._id,reviewedAt:d("2026-08-12T14:30:00Z"),reviewNotes:"Accepted for active distribution point."},
      {initiative:inProgress._id,taskId:ids.b.t[2],volunteer:tarek._id,status:APPLICATION_STATUSES.WITHDRAWN,applicationMessage:"I can support the inventory audit.",eligibilitySnapshot:{matchedSkills:["inventory"],missingSkills:[],serviceAreaMatched:true,taskUnlockedAtApplication:false},reviewNotes:"Volunteer withdrew before the task became available."},
      {initiative:published._id,taskId:ids.e.t[0],volunteer:sara._id,status:APPLICATION_STATUSES.COMPLETED,applicationMessage:"I can manage participant registration.",eligibilitySnapshot:{matchedSkills:["registration"],missingSkills:[],serviceAreaMatched:true,taskUnlockedAtApplication:true},reviewedBy:nour._id,reviewedAt:d("2026-07-08T13:00:00Z"),reviewNotes:"Accepted for registration desk.",checkInAt:d("2026-07-10T07:45:00Z"),checkOutAt:d("2026-07-10T15:30:00Z"),completionEvidenceMediaIds:[]},
      {initiative:published._id,taskId:ids.e.t[1],volunteer:omar._id,status:APPLICATION_STATUSES.COMPLETED,applicationMessage:"Available for event support and participant guidance.",eligibilitySnapshot:{matchedSkills:["event support"],missingSkills:["first aid"],serviceAreaMatched:true,taskUnlockedAtApplication:true},reviewedBy:nour._id,reviewedAt:d("2026-07-08T13:30:00Z"),reviewNotes:"Accepted for non-clinical event support.",checkInAt:d("2026-07-10T08:00:00Z"),checkOutAt:d("2026-07-10T16:00:00Z"),completionEvidenceMediaIds:[]},
    ]);
    const [appAccepted,appPending,appRejected,appCompleted,appAccepted2,appWithdrawn,appCompleted2,appCompleted3] = applications;

    const events = await ExecutionEvent.create([
      {initiative:coastal._id,eventType:"initiative_approved",actor:ahmad._id,organization:tripoli._id,description:"Tripoli Municipality approved the coastal cleanup initiative.",occurredAt:d("2026-08-10T09:00:00Z")},
      {initiative:coastal._id,eventType:"resource_reserved",actor:rana._id,organization:green._id,resource:bagsMain._id,description:"Seventy cleanup bags were reserved from an accepted contribution offer.",metadata:{reservationId:s(resBags._id),resourceRequirementId:s(ids.a.r[0])},occurredAt:d("2026-08-11T09:05:00Z")},
      {initiative:coastal._id,eventType:"resource_reserved",actor:rana._id,organization:green._id,resource:containers._id,description:"Eight waste containers were reserved from an accepted resource request.",metadata:{reservationId:s(resContainers._id)},occurredAt:d("2026-08-11T09:15:00Z")},
      {initiative:coastal._id,eventType:"readiness_changed",actor:rana._id,description:"Readiness changed to partially resourced after initial reservations.",metadata:{readiness:READINESS_STATUSES.PARTIALLY_RESOURCED},occurredAt:d("2026-08-11T09:20:00Z")},
      {initiative:coastal._id,eventType:"volunteer_assigned",actor:rana._id,organization:green._id,taskId:ids.a.t[0],description:"Omar was accepted for the preparation task.",metadata:{volunteerApplicationId:s(appAccepted._id)},occurredAt:d("2026-08-11T12:00:00Z")},
      {initiative:inProgress._id,eventType:"initiative_approved",actor:layla._id,organization:tripoli._id,description:"The emergency support drive was approved.",occurredAt:d("2026-08-05T10:00:00Z")},
      {initiative:inProgress._id,eventType:"initiative_started",actor:nour._id,organization:care._id,description:"Execution of the emergency support drive started.",occurredAt:d("2026-08-12T07:20:00Z")},
      {initiative:inProgress._id,eventType:"task_completed",actor:nour._id,organization:care._id,taskId:ids.b.t[0],description:"The distribution route confirmation task was completed.",occurredAt:d("2026-08-12T11:30:00Z")},
      {initiative:inProgress._id,eventType:"task_unlocked",actor:nour._id,organization:care._id,taskId:ids.b.t[1],description:"The distribution task was unlocked after prerequisite completion and resource readiness.",occurredAt:d("2026-08-12T11:35:00Z")},
      {initiative:inProgress._id,eventType:"task_started",actor:nour._id,organization:care._id,taskId:ids.b.t[1],description:"The distribution-point task started.",occurredAt:d("2026-08-15T07:10:00Z")},
      {initiative:inProgress._id,eventType:"resource_reserved",actor:nour._id,resource:vans._id,description:"Two transport vans were reserved.",metadata:{reservationId:s(resVans._id)},occurredAt:d("2026-08-10T09:05:00Z")},
      {initiative:inProgress._id,eventType:"volunteer_checked_in",actor:omar._id,taskId:ids.b.t[1],description:"Omar checked in for the distribution shift.",metadata:{volunteerApplicationId:s(appCompleted._id)},occurredAt:d("2026-08-15T07:05:00Z")},
      {initiative:withdrawal._id,eventType:"initiative_approved",actor:ahmad._id,organization:tripoli._id,description:"The emergency water support initiative was approved.",occurredAt:d("2026-08-05T09:00:00Z")},
      {initiative:withdrawal._id,eventType:"resource_reserved",actor:rana._id,resource:tankerOld._id,description:"Two water tankers were originally reserved.",metadata:{reservationId:s(resWithdrawn._id)},occurredAt:d("2026-08-08T09:05:00Z")},
      {initiative:withdrawal._id,eventType:"resource_withdrawn",actor:maya._id,organization:equip._id,resource:tankerOld._id,description:"The original resource partner withdrew two reserved water tankers.",metadata:{reservationId:s(resWithdrawn._id),resourceRequirementId:s(ids.d.r[0])},occurredAt:d("2026-08-12T08:32:00Z")},
      {initiative:withdrawal._id,eventType:"readiness_changed",actor:rana._id,description:"Readiness became blocked after the tanker requirement reopened.",metadata:{readiness:READINESS_STATUSES.BLOCKED,reopenedRequirementId:s(ids.d.r[0])},occurredAt:d("2026-08-12T08:40:00Z")},
      {initiative:published._id,eventType:"initiative_started",actor:nour._id,organization:care._id,description:"Community Health Day execution started.",occurredAt:d("2026-07-10T08:10:00Z")},
      {initiative:published._id,eventType:"resource_delivered",actor:dalia._id,organization:medical._id,resource:kits._id,description:"Twenty first-aid kits were delivered and fulfilled.",metadata:{reservationId:s(resHealthKits._id)},occurredAt:d("2026-07-10T07:30:00Z")},
      {initiative:published._id,eventType:"volunteer_completed",actor:sara._id,taskId:ids.e.t[0],description:"Sara completed her health-day registration volunteer shift.",metadata:{volunteerApplicationId:s(appCompleted2._id)},occurredAt:d("2026-07-10T15:30:00Z")},
      {initiative:published._id,eventType:"inspection_completed",actor:ahmad._id,organization:tripoli._id,description:"Municipality inspection passed for the completed health initiative.",occurredAt:d("2026-07-16T10:00:00Z")},
      {initiative:published._id,eventType:"completion_requested",actor:nour._id,organization:care._id,description:"The lead organization requested completion approval.",occurredAt:d("2026-07-15T15:10:00Z")},
      {initiative:published._id,eventType:"completion_approved",actor:ahmad._id,organization:tripoli._id,description:"The municipality approved completion.",occurredAt:d("2026-07-16T11:00:00Z")},
      {initiative:published._id,eventType:"initiative_published",actor:ahmad._id,organization:tripoli._id,description:"The completed initiative was published.",occurredAt:d("2026-07-18T09:00:00Z")},
    ]);

    const notifications = await Notification.create([
      notification({recipient:ahmad._id,type:"issue_status_changed",title:"New issue submitted",message:"A waste accumulation issue has been submitted for municipal review.",entityType:"Issue",entityId:issueSubmitted._id,url:`/issues/${issueSubmitted._id}`,deliveredAt:"2026-08-10T09:05:00Z"}),
      notification({recipient:rana._id,type:"initiative_decision",title:"Initiative approved",message:"Tripoli Coastal Cleanup Campaign was approved by the municipality.",entityType:"Initiative",entityId:coastal._id,url:`/initiatives/${coastal._id}`,deliveredAt:"2026-08-10T09:01:00Z",readAt:"2026-08-10T10:00:00Z"}),
      notification({recipient:rana._id,type:"resource_match",title:"Resource matches available",message:"Matching resources are available for unmet cleanup requirements.",entityType:"Initiative",entityId:coastal._id,url:`/initiatives/${coastal._id}/resources`,deliveredAt:"2026-08-10T09:10:00Z"}),
      notification({recipient:rana._id,type:"new_contribution_offer",title:"New contribution offer",message:"Lebanon Medical Supplies submitted a paid first-aid kit offer.",entityType:"ContributionOffer",entityId:offerSubmittedKits._id,url:`/contribution-offers/${offerSubmittedKits._id}`,deliveredAt:"2026-08-11T10:00:00Z"}),
      notification({recipient:maya._id,type:"system",title:"Resource request accepted",message:"The container request was accepted and converted into an active reservation.",entityType:"Resource",entityId:containers._id,url:`/resources/${containers._id}`,deliveredAt:"2026-08-11T09:16:00Z",readAt:"2026-08-11T11:00:00Z"}),
      notification({recipient:omar._id,type:"volunteer_assignment",title:"Volunteer application accepted",message:"You were accepted for the coastal-cleanup preparation task.",entityType:"VolunteerApplication",entityId:appAccepted._id,url:`/volunteer-applications/${appAccepted._id}`,deliveredAt:"2026-08-11T12:01:00Z"}),
      notification({recipient:nour._id,type:"readiness_changed",title:"Initiative ready to execute",message:"All resource requirements for the emergency support drive are reserved.",entityType:"Initiative",entityId:inProgress._id,url:`/initiatives/${inProgress._id}`,deliveredAt:"2026-08-12T06:01:00Z",readAt:"2026-08-12T07:00:00Z"}),
      notification({recipient:sara._id,type:"volunteer_assignment",title:"Volunteer assignment accepted",message:"You were accepted for the active distribution-point task.",entityType:"VolunteerApplication",entityId:appAccepted2._id,url:`/volunteer-applications/${appAccepted2._id}`,deliveredAt:"2026-08-12T14:31:00Z"}),
      notification({recipient:rana._id,type:"resource_withdrawn",title:"Reserved water tankers withdrawn",message:"North Equipment Partners withdrew the two previously reserved water tankers.",entityType:"Resource",entityId:tankerOld._id,url:`/initiatives/${withdrawal._id}/resources`,deliveredAt:"2026-08-12T08:33:00Z"}),
      notification({recipient:rana._id,type:"readiness_changed",title:"Requirement reopened",message:"The emergency water tanker requirement is unmet again and has been reopened.",entityType:"Initiative",entityId:withdrawal._id,url:`/initiatives/${withdrawal._id}/resources`,deliveredAt:"2026-08-12T08:41:00Z"}),
      notification({recipient:rana._id,type:"resource_reassigned",title:"Replacement resource available",message:"Community Logistics Group has replacement tanker capacity matching the reopened requirement.",entityType:"Resource",entityId:tankerReplacement._id,url:`/resources/${tankerReplacement._id}`,deliveredAt:"2026-08-12T08:45:00Z"}),
      notification({recipient:joseph._id,type:"system",title:"Replacement resource request received",message:"A pending request was created for two replacement water tankers.",entityType:"Organization",entityId:logistics._id,url:`/resource-requests/${reqReplacement._id}`,deliveredAt:"2026-08-12T08:50:00Z"}),
      notification({recipient:karim._id,type:"initiative_decision",title:"Changes requested",message:"Mina Municipality requested changes to the park rehabilitation initiative.",entityType:"Initiative",entityId:changesRequested._id,url:`/initiatives/${changesRequested._id}`,deliveredAt:"2026-08-09T14:01:00Z"}),
      notification({recipient:karim._id,type:"system",title:"Initiative submitted",message:"School Entrance Accessibility Upgrade is waiting for municipality review.",entityType:"Initiative",entityId:submitted._id,url:`/initiatives/${submitted._id}`,deliveredAt:"2026-08-12T10:01:00Z",readAt:"2026-08-12T10:30:00Z"}),
      notification({recipient:nour._id,type:"completion_decision",title:"Completion approved",message:"Tripoli Community Health Day passed inspection and completion was approved.",entityType:"Initiative",entityId:published._id,url:`/initiatives/${published._id}`,deliveredAt:"2026-07-16T11:01:00Z",readAt:"2026-07-16T12:00:00Z"}),
      notification({recipient:nour._id,type:"system",title:"Initiative published",message:"Tripoli Community Health Day has been published with verified impact metrics.",entityType:"Initiative",entityId:published._id,url:`/initiatives/${published._id}`,deliveredAt:"2026-07-18T09:01:00Z",readAt:"2026-07-18T10:00:00Z"}),
      notification({recipient:rana._id,type:"resource_match",title:"Partial cleanup-bag match available",message:"A second resource has only 50 matching bags, useful for partial-availability ranking tests.",entityType:"Resource",entityId:bagsPartial._id,url:`/resources/${bagsPartial._id}`,deliveredAt:"2026-08-12T09:00:00Z"}),
      notification({recipient:samer._id,type:"schedule_updated",title:"Cleanup schedule available",message:"The approved coastal cleanup phases and dates are ready for coordination.",entityType:"Initiative",entityId:coastal._id,url:`/initiatives/${coastal._id}`,deliveredAt:"2026-08-12T09:05:00Z"}),
    ]);

    await validateRelationships();

    const stats = {
      organizations: await Organization.countDocuments({ registrationNumber: { $regex: `^${SEED_PREFIX}` } }),
      issues: await Issue.countDocuments({}),
      initiatives: await Initiative.countDocuments({}),
      resources: await Resource.countDocuments({}),
      resourceRequirements: await ResourceRequirement.countDocuments({}),
      resourceRequests: await ResourceRequest.countDocuments({}),
      contributionOffers: await ContributionOffer.countDocuments({}),
      resourceReservations: await ResourceReservation.countDocuments({}),
      volunteerApplications: await VolunteerApplication.countDocuments({}),
      executionEvents: await ExecutionEvent.countDocuments({}),
      notifications: await Notification.countDocuments({}),
    };
    console.table(stats);

    const postmanIds = {
      APPROVED_INITIATIVE_ID:s(coastal._id), IN_PROGRESS_INITIATIVE_ID:s(inProgress._id), CHANGES_REQUESTED_INITIATIVE_ID:s(changesRequested._id), WITHDRAWAL_SCENARIO_INITIATIVE_ID:s(withdrawal._id), PUBLISHED_INITIATIVE_ID:s(published._id), DRAFT_INITIATIVE_ID:s(draft._id), SUBMITTED_INITIATIVE_ID:s(submitted._id), REJECTED_INITIATIVE_ID:s(rejected._id),
      CONVERTED_ISSUE_ID:s(issueConverted._id), SUBMITTED_ISSUE_ID:s(issueSubmitted._id), UNDER_REVIEW_ISSUE_ID:s(issueUnderReview._id),
      UNMET_REQUIREMENT_ID:s(ids.a.r[2]), PARTIALLY_RESERVED_REQUIREMENT_ID:s(ids.a.r[0]), FULLY_RESERVED_REQUIREMENT_ID:s(ids.a.r[1]), REOPENED_REQUIREMENT_ID:s(ids.d.r[0]), DELIVERED_REQUIREMENT_ID:s(ids.e.r[0]),
      AVAILABLE_RESOURCE_ID:s(tankerReplacement._id), PARTIALLY_RESERVED_RESOURCE_ID:s(bagsMain._id), FULLY_RESERVED_RESOURCE_ID:s(venue._id), WRONG_AREA_RESOURCE_ID:s(bagsWrongArea._id), WRONG_DATE_RESOURCE_ID:s(bagsWrongDates._id), INACTIVE_RESOURCE_ID:s(bagsInactive._id), UNAVAILABLE_RESOURCE_ID:s(sanitation._id), PARTIAL_QUANTITY_MATCH_RESOURCE_ID:s(bagsPartial._id),
      PENDING_RESOURCE_REQUEST_ID:s(reqPendingKits._id), ACCEPTED_RESOURCE_REQUEST_ID:s(reqContainers._id), REJECTED_RESOURCE_REQUEST_ID:s(reqRejectedDates._id), WITHDRAWN_RESOURCE_REQUEST_ID:s(reqWithdrawnTransport._id), FULFILLED_RESOURCE_REQUEST_ID:s(reqHealthKits._id), REPLACEMENT_RESOURCE_REQUEST_ID:s(reqReplacement._id),
      SUBMITTED_CONTRIBUTION_OFFER_ID:s(offerSubmittedKits._id), UNDER_REVIEW_CONTRIBUTION_OFFER_ID:s(offerUnderReviewContainers._id), ACCEPTED_CONTRIBUTION_OFFER_ID:s(offerAcceptedBags._id), REJECTED_CONTRIBUTION_OFFER_ID:s(offerRejectedArea._id), WITHDRAWN_CONTRIBUTION_OFFER_ID:s(offerWithdrawnWater._id), COMPLETED_CONTRIBUTION_OFFER_ID:s(offerCompletedMedical._id),
      ACTIVE_RESERVATION_ID:s(resBags._id), WITHDRAWN_RESERVATION_ID:s(resWithdrawn._id), FULFILLED_RESERVATION_ID:s(resHealthKits._id),
      PENDING_VOLUNTEER_APPLICATION_ID:s(appPending._id), ACCEPTED_VOLUNTEER_APPLICATION_ID:s(appAccepted._id), REJECTED_VOLUNTEER_APPLICATION_ID:s(appRejected._id), WITHDRAWN_VOLUNTEER_APPLICATION_ID:s(appWithdrawn._id), COMPLETED_VOLUNTEER_APPLICATION_ID:s(appCompleted._id),
      COASTAL_PREPARATION_TASK_ID:s(ids.a.t[0]), COASTAL_CLEANUP_TASK_ID:s(ids.a.t[1]), IN_PROGRESS_TASK_ID:s(ids.b.t[1]), COMPLETED_TASK_ID:s(ids.b.t[0]),
      TRIPOLI_MUNICIPALITY_ID:s(tripoli._id), GREEN_FUTURE_ORG_ID:s(green._id), NORTH_EQUIPMENT_ORG_ID:s(equip._id),
    };
    console.log("\nImportant IDs for Postman:");
    console.table(postmanIds);
    console.log("\nSeed completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
};

seedDatabase();
