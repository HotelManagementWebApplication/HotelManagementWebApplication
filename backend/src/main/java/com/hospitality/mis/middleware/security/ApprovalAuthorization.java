package com.hospitality.mis.middleware.security;
import com.hospitality.mis.dao.governance.ApprovalDatabase;
import org.springframework.stereotype.Component;

/** Read the persisted requester through the SQL read model, never client input. */
@Component("approvalAuthorization")
public class ApprovalAuthorization {
    private final ApprovalDatabase database;
    public ApprovalAuthorization(ApprovalDatabase database){this.database=database;}
    public boolean canApprove(Long id,String actor){
        if(id==null||actor==null||actor.isBlank())return false;
        return database.find(id).map(row->!actor.equals(row.requester())).orElse(false);
    }
}
